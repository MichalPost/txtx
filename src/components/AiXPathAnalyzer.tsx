import { useState } from "react";
import { Sparkles, Loader2, Check, X, AlertCircle, ChevronRight, Code2, Wand2 } from "lucide-react";
import { Button } from "@/components/Button";
import { useAiStore } from "@/store/aiStore";
import { apiFetchSource } from "@/lib/api/files";
import { aiComplete, aiExtract, preprocessHtml, extractJson, validateXPath } from "@/lib/ai";
import type { WebsiteConfig } from "@/types";

// ─── Field definitions ─────────────────────────────────────────────────────────

const XPATH_FIELD_LABELS: Array<{
  key: keyof Pick<
    WebsiteConfig,
    | "list_novel_name"
    | "release_date"
    | "release_url"
    | "novel_name_x"
    | "chapter_url_x"
    | "novel_content"
  >;
  label: string;
}> = [
  { key: "list_novel_name", label: "列表页书名" },
  { key: "release_date",    label: "更新日期" },
  { key: "release_url",     label: "书目链接" },
  { key: "novel_name_x",    label: "详情页书名" },
  { key: "chapter_url_x",   label: "章节链接" },
  { key: "novel_content",   label: "正文内容" },
];

type FieldKey = typeof XPATH_FIELD_LABELS[number]["key"];

// ─── Analysis mode ─────────────────────────────────────────────────────────────

type AnalysisMode = "xpath" | "extract";

const MODE_CONFIG: Record<AnalysisMode, { label: string; icon: React.FC<{ className?: string }>; desc: string }> = {
  xpath: {
    label: "XPath 模式",
    icon: ({ className }) => <Code2 className={className} />,
    desc: "让 AI 生成 XPath 选择器，本地验证命中数。适合需要精确复用选择器的场景。",
  },
  extract: {
    label: "直接提取模式",
    icon: ({ className }) => <Wand2 className={className} />,
    desc: "kumo LlmClient 直接从 HTML 提取结构化内容，无需 XPath，更宽容但不可复用。",
  },
};

// ─── Extract mode schema ───────────────────────────────────────────────────────

// JSON Schema 告诉 kumo LlmClient 要提取哪些字段（文本内容，不是选择器）
const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    list_novel_name: { type: "string", description: "列表页中第一本书的书名（纯文本）" },
    release_date:    { type: "string", description: "第一本书的最新更新日期" },
    release_url:     { type: "string", description: "第一本书详情页的完整 URL" },
    novel_name_x:    { type: "string", description: "详情页书名的 XPath（如能推断）" },
    chapter_url_x:   { type: "string", description: "章节列表链接的 XPath（如能推断）" },
    novel_content:   { type: "string", description: "正文内容区域的 XPath（如能推断）" },
  },
  required: [],
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FieldResult {
  key: FieldKey;
  label: string;
  currentValue: string;
  suggested: string;
  explanation: string;
  validation: { count: number; samples: string[]; error?: string } | null;
  adopted: boolean;
}

interface AiXPathAnalyzerProps {
  site: WebsiteConfig;
  onApply: (patch: Partial<WebsiteConfig>) => void;
  onClose: () => void;
}

// ─── System prompt (XPath mode) ───────────────────────────────────────────────

const AI_BATCH_SYSTEM = `你是专门分析中文小说网站 HTML 结构的专家。
一次性分析给定字段，输出严格 JSON，不含其他内容：
{
  "list_novel_name": {"xpath":"...","explanation":"..."},
  "release_date":    {"xpath":"...","explanation":"..."},
  "release_url":     {"xpath":"...","explanation":"..."},
  "novel_name_x":    {"xpath":"...","explanation":"..."},
  "chapter_url_x":   {"xpath":"...","explanation":"..."},
  "novel_content":   {"xpath":"...","explanation":"..."}
}
规则：优先用 id/class 属性，文本加 /text()，链接加 /@href，用 // 全局路径。
无把握的字段 xpath 留空字符串。`;

// ─── Component ─────────────────────────────────────────────────────────────────

export function AiXPathAnalyzer({ site, onApply, onClose }: AiXPathAnalyzerProps) {
  const { config: aiConfig } = useAiStore();
  const [mode, setMode] = useState<AnalysisMode>("xpath");
  const [phase, setPhase] = useState<"idle" | "fetching" | "analyzing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<FieldResult[]>([]);

  // reset results when mode changes so stale data doesn't show
  const handleModeChange = (next: AnalysisMode) => {
    if (next === mode) return;
    setMode(next);
    setPhase("idle");
    setResults([]);
    setErrorMsg("");
  };

  // ── XPath mode analysis ────────────────────────────────────────────────────

  const runXpathAnalysis = async (rawHtml: string) => {
    const processed = preprocessHtml(rawHtml);
    const userPrompt = `网站：${site.domain_name}\n\n分析以下 HTML，为 6 个字段生成 XPath：\n${processed}`;
    const reply = await aiComplete(userPrompt, AI_BATCH_SYSTEM, aiConfig);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = extractJson(reply) as any;

    return XPATH_FIELD_LABELS.map(({ key, label }) => {
      const item = parsed?.[key] ?? {};
      const xpath: string = item.xpath ?? "";
      const explanation: string = item.explanation ?? "";
      const validation = (xpath && rawHtml) ? validateXPath(rawHtml, xpath) : null;
      return { key, label, currentValue: (site[key] as string) ?? "", suggested: xpath, explanation, validation, adopted: !!xpath };
    });
  };

  // ── Extract mode analysis ──────────────────────────────────────────────────

  const runExtractAnalysis = async (rawHtml: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extracted = await aiExtract<Record<string, any>>(rawHtml, EXTRACT_SCHEMA, aiConfig);

    return XPATH_FIELD_LABELS.map(({ key, label }) => {
      const value: string = extracted?.[key] ?? "";
      // In extract mode the "suggested" value is the extracted text/xpath — still validate if it looks like xpath
      const looksLikeXpath = value.startsWith("//") || value.startsWith("(//");
      const validation = (looksLikeXpath && rawHtml) ? validateXPath(rawHtml, value) : null;
      return {
        key, label,
        currentValue: (site[key] as string) ?? "",
        suggested: value,
        explanation: value ? "直接从页面提取的内容" : "",
        validation,
        adopted: !!value,
      };
    });
  };

  // ── Shared start ───────────────────────────────────────────────────────────

  const startAnalysis = async () => {
    if (!site.domain_name || !aiConfig.enabled) return;
    setPhase("fetching");
    setErrorMsg("");
    try {
      const rawHtml = await apiFetchSource(site.domain_name);
      setPhase("analyzing");
      const fieldResults = mode === "xpath"
        ? await runXpathAnalysis(rawHtml)
        : await runExtractAnalysis(rawHtml);
      setResults(fieldResults);
      setPhase("done");
    } catch (e) {
      setErrorMsg(String(e));
      setPhase("error");
    }
  };

  const toggleAdopt = (key: FieldKey) => {
    setResults((prev) => prev.map((r) => r.key === key ? { ...r, adopted: !r.adopted } : r));
  };

  const applySelected = () => {
    const patch: Partial<WebsiteConfig> = {};
    for (const r of results) {
      if (r.adopted && r.suggested) {
        (patch as Record<string, string>)[r.key] = r.suggested;
      }
    }
    onApply(patch);
    onClose();
  };

  const adoptedCount = results.filter((r) => r.adopted && r.suggested).length;
  const ModeIcon = MODE_CONFIG[mode].icon;

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-xl border"
      style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: "var(--color-accent)" }} />
        <span className="text-sm font-semibold flex-1" style={{ color: "var(--color-text)" }}>
          AI 批量分析 XPath
        </span>
        <button
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity"
          style={{ color: "var(--color-text-muted)" }}
          onClick={onClose}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mode switcher */}
      <div
        className="flex rounded-lg p-0.5 gap-0.5"
        style={{ background: "var(--color-surface)" }}
      >
        {(Object.keys(MODE_CONFIG) as AnalysisMode[]).map((m) => {
          const Icon = MODE_CONFIG[m].icon;
          const active = m === mode;
          return (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: active ? "var(--color-surface-1)" : "transparent",
                color: active ? "var(--color-text)" : "var(--color-text-muted)",
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              <Icon className="w-3 h-3" />
              {MODE_CONFIG[m].label}
            </button>
          );
        })}
      </div>

      {/* Mode description */}
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        <ModeIcon className="w-3 h-3 inline mr-1 -mt-0.5" />
        {MODE_CONFIG[mode].desc}
      </p>

      <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
        目标：<code style={{ color: "var(--color-accent)" }}>{site.domain_name}</code>
      </p>

      {/* Idle / Error */}
      {(phase === "idle" || phase === "error") && (
        <div className="flex flex-col gap-2">
          {phase === "error" && (
            <div
              className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
            >
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          <Button size="sm" onClick={startAnalysis} disabled={!aiConfig.enabled}>
            <Sparkles className="w-3.5 h-3.5" />
            {phase === "error" ? "重新分析" : "开始 AI 分析"}
          </Button>
        </div>
      )}

      {/* Fetching / Analyzing */}
      {(phase === "fetching" || phase === "analyzing") && (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--color-accent)" }} />
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {phase === "fetching" ? "正在获取页面源码..." : (
              mode === "xpath" ? "AI 正在分析结构，请稍候..." : "kumo 正在提取结构化内容..."
            )}
          </span>
        </div>
      )}

      {/* Results */}
      {phase === "done" && results.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            {results.map((r) => (
              <div
                key={r.key}
                className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border transition-all"
                style={{
                  background: r.adopted
                    ? "color-mix(in srgb, var(--color-accent) 5%, var(--color-surface))"
                    : "var(--color-surface)",
                  borderColor: r.adopted
                    ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
                    : "var(--color-border)",
                  cursor: r.suggested ? "pointer" : "default",
                }}
                onClick={() => r.suggested && toggleAdopt(r.key)}
              >
                {/* Field name + check */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
                    {r.label}
                  </span>
                  {r.suggested ? (
                    <div
                      className="flex items-center justify-center w-4 h-4 rounded-full shrink-0 ml-auto transition-colors"
                      style={{
                        background: r.adopted ? "var(--color-accent)" : "var(--color-border)",
                        color: r.adopted ? "#fff" : "transparent",
                      }}
                    >
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  ) : (
                    <span
                      className="ml-auto text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
                    >
                      无法生成
                    </span>
                  )}
                </div>

                {/* Current vs Suggested */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: "var(--color-text-subtle)" }}>
                      当前
                    </div>
                    <code
                      className="text-xs block truncate font-mono"
                      style={{ color: r.currentValue ? "var(--color-text-muted)" : "var(--color-text-subtle)" }}
                    >
                      {r.currentValue || "未设置"}
                    </code>
                  </div>
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: "var(--color-text-subtle)" }}>
                      {mode === "xpath" ? "AI 建议 XPath" : "提取结果"}
                    </div>
                    <code
                      className="text-xs block truncate font-mono"
                      style={{ color: r.suggested ? "var(--color-accent)" : "var(--color-text-subtle)" }}
                    >
                      {r.suggested || "—"}
                    </code>
                  </div>
                </div>

                {/* Validation (only when value looks like xpath) */}
                {r.validation && r.suggested && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {r.validation.error ? (
                      <span className="text-xs" style={{ color: "var(--color-danger)" }}>
                        XPath 语法错误
                      </span>
                    ) : (
                      <>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{
                            background: r.validation.count > 0 ? "var(--color-success-bg)" : "var(--color-warning-bg)",
                            color: r.validation.count > 0 ? "var(--color-success)" : "var(--color-warning)",
                          }}
                        >
                          命中 {r.validation.count} 个
                        </span>
                        {r.validation.samples.length > 0 && (
                          <span className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                            {r.validation.samples.slice(0, 2).join("、")}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Explanation */}
                {r.explanation && (
                  <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                    {r.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Apply button */}
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={applySelected} disabled={adoptedCount === 0}>
              <ChevronRight className="w-3.5 h-3.5" />
              应用已选字段（{adoptedCount} 个）
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              取消
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

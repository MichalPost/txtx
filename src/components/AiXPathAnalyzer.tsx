import { useState, type ComponentType } from "react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Code2,
  Loader2,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";

import { Button } from "@/components/Button";
import { parseAiXPathAnalysis } from "@/components/aiXPathAnalysis";
import { applyAndClose } from "@/lib/applyAndClose";
import { aiComplete, aiExtract, extractJson, preprocessHtml, validateXPath } from "@/lib/ai";
import { apiFetchSource } from "@/lib/api/files";
import { useAiStore } from "@/store/aiStore";
import type { WebsiteConfig } from "@/types";

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
  { key: "list_novel_name", label: "目录页书名" },
  { key: "release_date", label: "更新日期" },
  { key: "release_url", label: "详情页链接" },
  { key: "novel_name_x", label: "章节页书名" },
  { key: "chapter_url_x", label: "章节链接" },
  { key: "novel_content", label: "正文内容" },
];

type FieldKey = (typeof XPATH_FIELD_LABELS)[number]["key"];
type AnalysisMode = "xpath" | "extract";
type ValidationState = { count: number; samples: string[]; error?: string } | null;

const MODE_CONFIG: Record<
  AnalysisMode,
  { label: string; icon: ComponentType<{ className?: string }>; desc: string }
> = {
  xpath: {
    label: "XPath 模式",
    icon: Code2,
    desc: "让 AI 直接生成 XPath，并在本地校验语法和命中情况，适合需要可复用规则的场景。",
  },
  extract: {
    label: "提取模式",
    icon: Wand2,
    desc: "让 AI 直接从 HTML 中提取候选结果；若结果看起来像 XPath，也会同时校验其有效性。",
  },
};

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    list_novel_name: { type: "string", description: "目录页第一条书名或书名对应的 XPath" },
    release_date: { type: "string", description: "最新章节的更新时间或对应 XPath" },
    release_url: { type: "string", description: "最新章节详情页链接或对应 XPath" },
    novel_name_x: { type: "string", description: "章节页书名或对应 XPath" },
    chapter_url_x: { type: "string", description: "章节列表链接或对应 XPath" },
    novel_content: { type: "string", description: "正文内容区域或对应 XPath" },
  },
  required: [],
};

interface FieldResult {
  key: FieldKey;
  label: string;
  currentValue: string;
  suggested: string;
  explanation: string;
  validation: ValidationState;
  adopted: boolean;
}

interface AiXPathAnalyzerProps {
  site: WebsiteConfig;
  onApply: (patch: Partial<WebsiteConfig>) => void | Promise<void>;
  onClose: () => void;
}

const AI_BATCH_SYSTEM = `你是专门分析小说网站 HTML 结构的专家。
请一次性分析下面这些字段，并仅返回严格 JSON：
{
  "list_novel_name": {"xpath":"...","explanation":"..."},
  "release_date":    {"xpath":"...","explanation":"..."},
  "release_url":     {"xpath":"...","explanation":"..."},
  "novel_name_x":    {"xpath":"...","explanation":"..."},
  "chapter_url_x":   {"xpath":"...","explanation":"..."},
  "novel_content":   {"xpath":"...","explanation":"..."}
}
优先使用稳定的 id/class、文本、/text()、链接 /@href 和 // 相对路径。
无法判断的字段请返回空字符串。`;

function isValidationInvalid(validation: ValidationState): boolean {
  return !!validation && (!!validation.error || validation.count <= 0);
}

function canAdoptSuggestion(suggested: string, validation: ValidationState): boolean {
  if (!suggested.trim()) return false;
  if (!validation) return true;
  return !isValidationInvalid(validation);
}

function buildFieldResult(args: {
  key: FieldKey;
  label: string;
  currentValue: string;
  suggested: string;
  explanation: string;
  validation: ValidationState;
}): FieldResult {
  return {
    ...args,
    adopted: canAdoptSuggestion(args.suggested, args.validation),
  };
}

export function AiXPathAnalyzer({ site, onApply, onClose }: AiXPathAnalyzerProps) {
  const aiEnabled = useAiStore((s) => s.config.enabled);
  const aiConfig = useAiStore((s) => s.activeConfig());
  const [mode, setMode] = useState<AnalysisMode>("xpath");
  const [phase, setPhase] = useState<"idle" | "fetching" | "analyzing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<FieldResult[]>([]);

  const handleModeChange = (next: AnalysisMode) => {
    if (next === mode) return;
    setMode(next);
    setPhase("idle");
    setResults([]);
    setErrorMsg("");
  };

  const runXpathAnalysis = async (rawHtml: string) => {
    const processed = preprocessHtml(rawHtml);
    const userPrompt = `站点：${site.domain_name}\n\n请根据下面的 HTML，为 6 个字段分别生成 XPath：\n${processed}`;
    const reply = await aiComplete(userPrompt, AI_BATCH_SYSTEM, aiConfig);
    const analysis = parseAiXPathAnalysis(extractJson(reply), null);

    return XPATH_FIELD_LABELS.map(({ key, label }) => {
      const item = analysis.find((entry) => entry.key === key);
      const suggested = item?.suggested ?? "";
      const validation = suggested && rawHtml ? validateXPath(rawHtml, suggested) : null;
      return buildFieldResult({
        key,
        label,
        currentValue: (site[key] as string) ?? "",
        suggested,
        explanation: item?.explanation ?? "",
        validation,
      });
    });
  };

  const runExtractAnalysis = async (rawHtml: string) => {
    const extracted = await aiExtract<Record<string, unknown>>(rawHtml, EXTRACT_SCHEMA, aiConfig);
    const analysis = parseAiXPathAnalysis(null, extracted);

    return XPATH_FIELD_LABELS.map(({ key, label }) => {
      const item = analysis.find((entry) => entry.key === key);
      const suggested = item?.suggested ?? "";
      const looksLikeXpath = suggested.startsWith("//") || suggested.startsWith("(//");
      const validation = looksLikeXpath && rawHtml ? validateXPath(rawHtml, suggested) : null;
      return buildFieldResult({
        key,
        label,
        currentValue: (site[key] as string) ?? "",
        suggested,
        explanation: item?.explanation ?? "",
        validation,
      });
    });
  };

  const startAnalysis = async () => {
    if (!site.domain_name || !aiConfig.enabled) return;
    setPhase("fetching");
    setErrorMsg("");
    try {
      const rawHtml = await apiFetchSource(site.domain_name);
      setPhase("analyzing");
      const fieldResults =
        mode === "xpath" ? await runXpathAnalysis(rawHtml) : await runExtractAnalysis(rawHtml);
      setResults(fieldResults);
      setPhase("done");
    } catch (e) {
      setErrorMsg(String(e));
      setPhase("error");
    }
  };

  const toggleAdopt = (key: FieldKey) => {
    setResults((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        if (!canAdoptSuggestion(r.suggested, r.validation)) return r;
        return { ...r, adopted: !r.adopted };
      }),
    );
  };

  const applySelected = async () => {
    const patch: Partial<WebsiteConfig> = {};
    for (const r of results) {
      if (r.adopted && canAdoptSuggestion(r.suggested, r.validation)) {
        (patch as Record<string, string>)[r.key] = r.suggested;
      }
    }
    await applyAndClose(() => onApply(patch), onClose);
  };

  const adoptedCount = results.filter(
    (r) => r.adopted && canAdoptSuggestion(r.suggested, r.validation),
  ).length;
  const ModeIcon = MODE_CONFIG[mode].icon;

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-4"
      style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
        <span className="flex-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          AI XPath 分析器
        </span>
        <button
          className="flex h-6 w-6 items-center justify-center rounded-lg transition-opacity hover:opacity-70"
          style={{ color: "var(--color-text-muted)" }}
          onClick={onClose}
          aria-label="关闭 AI XPath 分析器"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: "var(--color-surface)" }}>
        {(Object.keys(MODE_CONFIG) as AnalysisMode[]).map((m) => {
          const Icon = MODE_CONFIG[m].icon;
          const active = m === mode;
          return (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all"
              style={{
                background: active ? "var(--color-surface-1)" : "transparent",
                color: active ? "var(--color-text)" : "var(--color-text-muted)",
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              <Icon className="h-3 w-3" />
              {MODE_CONFIG[m].label}
            </button>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        <ModeIcon className="-mt-0.5 mr-1 inline h-3 w-3" />
        {MODE_CONFIG[mode].desc}
      </p>

      <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
        目标站点：<code style={{ color: "var(--color-accent)" }}>{site.domain_name}</code>
      </p>

      {(phase === "idle" || phase === "error") && (
        <div className="flex flex-col gap-2">
          {phase === "error" && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          <Button size="sm" onClick={startAnalysis} disabled={!aiEnabled}>
            <Sparkles className="h-3.5 w-3.5" />
            {phase === "error" ? "重新分析" : "开始 AI 分析"}
          </Button>
        </div>
      )}

      {(phase === "fetching" || phase === "analyzing") && (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-accent)" }} />
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {phase === "fetching"
              ? "正在获取页面源码..."
              : mode === "xpath"
                ? "AI 正在分析页面结构并生成 XPath..."
                : "AI 正在提取结构化候选结果..."}
          </span>
        </div>
      )}

      {phase === "done" && results.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            {results.map((r) => {
              const canAdopt = canAdoptSuggestion(r.suggested, r.validation);
              const invalidReason = !r.suggested
                ? "未生成候选结果"
                : r.validation?.error
                  ? "XPath 语法错误，不能应用"
                  : r.validation && r.validation.count <= 0
                    ? "XPath 未命中任何节点，不能应用"
                    : "";

              return (
                <div
                  key={r.key}
                  className="flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 transition-all"
                  style={{
                    background: r.adopted
                      ? "color-mix(in srgb, var(--color-accent) 5%, var(--color-surface))"
                      : "var(--color-surface)",
                    borderColor: r.adopted
                      ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
                      : "var(--color-border)",
                    cursor: canAdopt ? "pointer" : "default",
                    opacity: canAdopt || r.suggested ? 1 : 0.7,
                  }}
                  onClick={() => canAdopt && toggleAdopt(r.key)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
                      {r.label}
                    </span>
                    {canAdopt ? (
                      <button
                        type="button"
                        aria-pressed={r.adopted}
                        aria-label={r.adopted ? `取消应用${r.label}` : `应用${r.label}`}
                        className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors"
                        style={{
                          background: r.adopted ? "var(--color-accent)" : "var(--color-border)",
                          color: r.adopted ? "#fff" : "transparent",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAdopt(r.key);
                        }}
                        title={r.adopted ? "取消应用此字段" : "应用此字段"}
                      >
                        <Check className="h-2.5 w-2.5" />
                      </button>
                    ) : (
                      <span
                        className="ml-auto rounded px-1.5 py-0.5 text-xs"
                        style={{
                          background: r.suggested
                            ? "var(--color-warning-bg)"
                            : "var(--color-danger-bg)",
                          color: r.suggested ? "var(--color-warning)" : "var(--color-danger)",
                        }}
                      >
                        {r.suggested ? "不可应用" : "未生成"}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="mb-0.5 text-xs" style={{ color: "var(--color-text-subtle)" }}>
                        当前值
                      </div>
                      <code
                        className="block truncate font-mono text-xs"
                        style={{
                          color: r.currentValue
                            ? "var(--color-text-muted)"
                            : "var(--color-text-subtle)",
                        }}
                      >
                        {r.currentValue || "未设置"}
                      </code>
                    </div>
                    <div>
                      <div className="mb-0.5 text-xs" style={{ color: "var(--color-text-subtle)" }}>
                        {mode === "xpath" ? "AI 建议 XPath" : "提取结果"}
                      </div>
                      <code
                        className="block truncate font-mono text-xs"
                        style={{
                          color: r.suggested ? "var(--color-accent)" : "var(--color-text-subtle)",
                        }}
                      >
                        {r.suggested || "无"}
                      </code>
                    </div>
                  </div>

                  {r.validation && r.suggested && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {r.validation.error ? (
                        <span className="text-xs" style={{ color: "var(--color-danger)" }}>
                          XPath 语法错误
                        </span>
                      ) : (
                        <>
                          <span
                            className="rounded-full px-1.5 py-0.5 text-xs"
                            style={{
                              background:
                                r.validation.count > 0
                                  ? "var(--color-success-bg)"
                                  : "var(--color-warning-bg)",
                              color:
                                r.validation.count > 0
                                  ? "var(--color-success)"
                                  : "var(--color-warning)",
                            }}
                          >
                            命中 {r.validation.count} 个
                          </span>
                          {r.validation.samples.length > 0 && (
                            <span
                              className="truncate text-xs"
                              style={{ color: "var(--color-text-muted)" }}
                            >
                              {r.validation.samples.slice(0, 2).join("；")}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {!canAdopt && invalidReason && (
                    <p className="text-xs" style={{ color: "var(--color-warning)" }}>
                      {invalidReason}
                    </p>
                  )}

                  {r.explanation && (
                    <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                      {r.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={() => void applySelected()} disabled={adoptedCount === 0}>
              <ChevronRight className="h-3.5 w-3.5" />
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

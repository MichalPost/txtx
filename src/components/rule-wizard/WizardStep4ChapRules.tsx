/**
 * Step 4 — 章节规则
 * 配置章节页解析规则：书名、章节链接、正文内容（含备用规则）
 */
import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FieldRuleEditor } from "./FieldRuleEditor";
import { apiFetchSource } from "@/lib/api/files";
import { aiComplete, preprocessHtml, extractJson } from "@/lib/ai";
import { useAiStore } from "@/store/aiStore";
import type { WizardData, FieldRule } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

const AI_SYSTEM = `你是专门分析中文小说网站 HTML 结构的专家。
分析章节页HTML，为以下字段生成XPath，严格输出JSON，不含其他内容：
{
  "chap_novel_name":  {"xpath":"...","explanation":"..."},
  "chap_chapter_url": {"xpath":"...","explanation":"..."},
  "chap_content":     {"xpath":"...","explanation":"..."}
}
规则：正文内容优先用 id="content" 或 class 含 content/txt/text 的 div，文本加 /text()。无把握的字段 xpath 留空字符串。`;

export function WizardStep4ChapRules({ data, onChange }: Props) {
  const { config: aiConfig } = useAiStore();
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [newFallback, setNewFallback] = useState("");

  const patch = (key: keyof Pick<WizardData,
    "chap_novel_name" | "chap_chapter_url" | "chap_content"
  >, rule: FieldRule) => {
    onChange({ ...data, [key]: rule });
  };

  const ensureChapHtml = async (): Promise<string> => {
    if (data.chapter_html) return data.chapter_html;
    const url = data.chapter_test_url || data.catalog_url;
    if (!url || url === "https://") throw new Error("请先完成第三步测试，获取章节 URL");
    const html = await apiFetchSource(url);
    onChange({ ...data, chapter_html: html });
    return html;
  };

  const runBatchAi = async () => {
    if (!aiConfig.enabled) return;
    setAiLoading("batch");
    setErrorMsg("");
    try {
      const html = await ensureChapHtml();
      const processed = preprocessHtml(html);
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n分析以下章节页 HTML，生成3个字段的 XPath：\n${processed}`,
        AI_SYSTEM,
        aiConfig
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;
      onChange({
        ...data,
        chapter_html: html,
        chap_novel_name:  applyAiResult(data.chap_novel_name,  parsed?.chap_novel_name),
        chap_chapter_url: applyAiResult(data.chap_chapter_url, parsed?.chap_chapter_url),
        chap_content:     applyAiResult(data.chap_content,     parsed?.chap_content),
      });
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setAiLoading(null);
    }
  };

  const runFieldAi = async (
    fieldKey: "chap_novel_name" | "chap_chapter_url" | "chap_content",
    fieldLabel: string
  ) => {
    if (!aiConfig.enabled) return;
    setAiLoading(fieldKey);
    setErrorMsg("");
    try {
      const html = await ensureChapHtml();
      const processed = preprocessHtml(html);
      const system = `你是专门分析中文小说网站HTML结构的专家。
为字段"${fieldLabel}"生成最合适的XPath，严格输出JSON：{"xpath":"...","explanation":"..."}
文本加/text()，链接加/@href。`;
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n分析以下章节页HTML，为"${fieldLabel}"字段生成XPath：\n${processed}`,
        system,
        aiConfig
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;
      const xpath: string = parsed?.xpath ?? "";
      onChange({
        ...data,
        chapter_html: html,
        [fieldKey]: { ...data[fieldKey], mode: "ai", xpath } as FieldRule,
      });
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setAiLoading(null);
    }
  };

  const addFallback = () => {
    const v = newFallback.trim();
    if (!v) return;
    onChange({ ...data, chap_content_fallbacks: [...data.chap_content_fallbacks, v] });
    setNewFallback("");
  };

  const removeFallback = (i: number) => {
    onChange({
      ...data,
      chap_content_fallbacks: data.chap_content_fallbacks.filter((_, idx) => idx !== i),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Instruction */}
      <div
        className="rounded-xl px-4 py-3 text-xs"
        style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
      >
        <p className="font-medium mb-1" style={{ color: "var(--color-text)" }}>第四步：设定章节页规则</p>
        <p>正文内容（主规则）为必填。章节链接和书名可选。若主规则在某些章节失效，可添加备用规则兜底。</p>
      </div>

      {/* Batch AI */}
      {aiConfig.enabled && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={runBatchAi} disabled={aiLoading !== null}>
            {aiLoading === "batch"
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Sparkles className="w-3.5 h-3.5" />
            }
            {aiLoading === "batch" ? "AI 分析中..." : "AI 批量分析章节页"}
          </Button>
          {data.chapter_test_url && (
            <span className="text-xs truncate max-w-xs" style={{ color: "var(--color-text-subtle)" }}>
              使用：{data.chapter_test_url}
            </span>
          )}
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Field editors */}
      <FieldRuleEditor
        label="详情页书名"
        rule={data.chap_novel_name}
        onChange={(r) => patch("chap_novel_name", r)}
        aiEnabled={aiConfig.enabled}
        onAiRequest={() => runFieldAi("chap_novel_name", "详情页书名")}
        aiLoading={aiLoading === "chap_novel_name"}
      />
      <FieldRuleEditor
        label="章节链接"
        rule={data.chap_chapter_url}
        onChange={(r) => patch("chap_chapter_url", r)}
        aiEnabled={aiConfig.enabled}
        onAiRequest={() => runFieldAi("chap_chapter_url", "章节链接")}
        aiLoading={aiLoading === "chap_chapter_url"}
      />
      <FieldRuleEditor
        label="正文内容 *"
        rule={data.chap_content}
        onChange={(r) => patch("chap_content", r)}
        aiEnabled={aiConfig.enabled}
        onAiRequest={() => runFieldAi("chap_content", "正文内容")}
        aiLoading={aiLoading === "chap_content"}
      />

      {/* Fallback rules */}
      <div
        className="flex flex-col gap-2 rounded-xl p-3 border"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
          内容备用规则（按顺序尝试）
        </span>
        {data.chap_content_fallbacks.map((fb, i) => (
          <div key={i} className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono truncate" style={{ color: "var(--color-text-muted)" }}>
              {fb}
            </code>
            <button
              onClick={() => removeFallback(i)}
              className="w-5 h-5 flex items-center justify-center rounded hover:opacity-70"
              style={{ color: "var(--color-danger)" }}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              placeholder="//div[@id='content']/text()"
              value={newFallback}
              onChange={(e) => setNewFallback(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addFallback(); }}
            />
          </div>
          <Button size="sm" variant="secondary" onClick={addFallback} disabled={!newFallback.trim()}>
            <Plus className="w-3.5 h-3.5" />
            添加
          </Button>
        </div>
      </div>
    </div>
  );
}

function applyAiResult(existing: FieldRule, result?: { xpath?: string }): FieldRule {
  const xpath = result?.xpath ?? "";
  if (!xpath) return existing;
  return { ...existing, mode: "ai", xpath };
}

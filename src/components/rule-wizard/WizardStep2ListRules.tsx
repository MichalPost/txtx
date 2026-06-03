/**
 * Step 2 — 目录规则
 * 配置列表页解析规则：书名、更新日期、书目链接
 * 支持 AI 批量分析（复用 aiComplete 逻辑）
 */
import { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/Button";
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
分析列表页HTML，为以下3个字段生成XPath，严格输出JSON，不含其他内容：
{
  "list_novel_name":   {"xpath":"...","explanation":"..."},
  "list_release_date": {"xpath":"...","explanation":"..."},
  "list_release_url":  {"xpath":"...","explanation":"..."}
}
规则：优先用 id/class 属性，文本加 /text()，链接加 /@href，用 // 全局路径。无把握的字段 xpath 留空字符串。`;

export function WizardStep2ListRules({ data, onChange }: Props) {
  const { config: aiConfig } = useAiStore();
  const [aiLoading, setAiLoading] = useState<string | null>(null); // field key or "batch"
  const [errorMsg, setErrorMsg] = useState("");

  const patch = (key: keyof Pick<WizardData, "list_novel_name" | "list_release_date" | "list_release_url">, rule: FieldRule) => {
    onChange({ ...data, [key]: rule });
  };

  // Ensure we have HTML to work with
  const ensureHtml = async (): Promise<string> => {
    if (data.catalog_html) return data.catalog_html;
    const url = data.catalog_url.trim();
    if (!url || url === "https://") throw new Error("请先在第一步填写目录页网址");
    const html = await apiFetchSource(url);
    onChange({ ...data, catalog_html: html });
    return html;
  };

  // Batch AI analysis for all list fields
  const runBatchAi = async () => {
    if (!aiConfig.enabled) return;
    setAiLoading("batch");
    setErrorMsg("");
    try {
      const html = await ensureHtml();
      const processed = preprocessHtml(html);
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n分析以下列表页 HTML，为3个字段生成 XPath：\n${processed}`,
        AI_SYSTEM,
        aiConfig
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;
      onChange({
        ...data,
        catalog_html: html,
        list_novel_name:   applyAiResult(data.list_novel_name,   parsed?.list_novel_name),
        list_release_date: applyAiResult(data.list_release_date, parsed?.list_release_date),
        list_release_url:  applyAiResult(data.list_release_url,  parsed?.list_release_url),
      });
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setAiLoading(null);
    }
  };

  // Single-field AI
  const runFieldAi = async (
    fieldKey: "list_novel_name" | "list_release_date" | "list_release_url",
    fieldLabel: string
  ) => {
    if (!aiConfig.enabled) return;
    setAiLoading(fieldKey);
    setErrorMsg("");
    try {
      const html = await ensureHtml();
      const processed = preprocessHtml(html);
      const system = `你是专门分析中文小说网站HTML结构的专家。
为字段"${fieldLabel}"生成最合适的XPath，严格输出JSON：{"xpath":"...","explanation":"..."}
文本加/text()，链接加/@href。`;
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n分析以下HTML，为"${fieldLabel}"字段生成XPath：\n${processed}`,
        system,
        aiConfig
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;
      const xpath: string = parsed?.xpath ?? "";
      onChange({
        ...data,
        catalog_html: html,
        [fieldKey]: { ...data[fieldKey], mode: "ai", xpath } as FieldRule,
      });
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setAiLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Instruction */}
      <div
        className="rounded-xl px-4 py-3 text-xs"
        style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
      >
        <p className="font-medium mb-1" style={{ color: "var(--color-text)" }}>第二步：设定目录页规则</p>
        <p>红色框为必填项，需根据 HTML 源码分析填写。设定好后用第三步的"测试"按钮验证是否正确。</p>
        <p className="mt-1">支持标签/属性/XPath 多种方式，也可点击"AI 批量分析"自动生成。</p>
      </div>

      {/* Batch AI button */}
      {aiConfig.enabled && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={runBatchAi}
            disabled={aiLoading !== null}
          >
            {aiLoading === "batch"
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Sparkles className="w-3.5 h-3.5" />
            }
            {aiLoading === "batch" ? "AI 分析中..." : "AI 批量分析所有字段"}
          </Button>
          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            自动生成所有规则，也可手动调整
          </span>
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
        label="列表页书名 *"
        rule={data.list_novel_name}
        onChange={(r) => patch("list_novel_name", r)}
        aiEnabled={aiConfig.enabled}
        onAiRequest={() => runFieldAi("list_novel_name", "列表页书名")}
        aiLoading={aiLoading === "list_novel_name"}
      />
      <FieldRuleEditor
        label="更新日期"
        rule={data.list_release_date}
        onChange={(r) => patch("list_release_date", r)}
        aiEnabled={aiConfig.enabled}
        onAiRequest={() => runFieldAi("list_release_date", "更新日期")}
        aiLoading={aiLoading === "list_release_date"}
      />
      <FieldRuleEditor
        label="书目链接 *"
        rule={data.list_release_url}
        onChange={(r) => patch("list_release_url", r)}
        aiEnabled={aiConfig.enabled}
        onAiRequest={() => runFieldAi("list_release_url", "书目链接")}
        aiLoading={aiLoading === "list_release_url"}
      />
    </div>
  );
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function applyAiResult(existing: FieldRule, result?: { xpath?: string }): FieldRule {
  const xpath = result?.xpath ?? "";
  if (!xpath) return existing;
  return { ...existing, mode: "ai", xpath };
}

/**
 * useWizardListRulesAi — WizardStep2ListRules 的 AI 逻辑 hook
 */
import { useState } from "react";
import { useAiStore } from "@/store/aiStore";
import { aiComplete, preprocessHtml, extractJson } from "@/lib/ai";
import { applyAiResult, AI_SYSTEM_LIST_FIELDS } from "../utils/wizardAiHelpers";
import type { WizardData, FieldRule } from "../ruleUtils";

export function useWizardListRulesAi(
  data: WizardData,
  onChange: (d: WizardData) => void,
  ensureHtml: () => Promise<string>,
  setError: (msg: string) => void,
) {
  const aiEnabled = useAiStore((s) => s.config.enabled);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const runBatchAi = async () => {
    if (!aiEnabled) return;
    setAiLoading("batch");
    setError("");
    try {
      const html = await ensureHtml();
      const aiConfig = useAiStore.getState().activeConfig();
      const processed = preprocessHtml(html);
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n分析以下目录页 HTML，为3个字段生成 XPath：\n${processed}`,
        AI_SYSTEM_LIST_FIELDS,
        aiConfig,
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
      setError(String(e));
    } finally {
      setAiLoading(null);
    }
  };

  const runFieldAi = async (
    fieldKey: "list_novel_name" | "list_release_date" | "list_release_url",
    fieldLabel: string,
  ) => {
    if (!aiEnabled) return;
    setAiLoading(fieldKey);
    setError("");
    try {
      const html = await ensureHtml();
      const aiConfig = useAiStore.getState().activeConfig();
      const processed = preprocessHtml(html);
      const system = `你是专门分析中文小说网站HTML结构的专家。
为字段"${fieldLabel}"生成最合适的XPath，严格输出JSON：{"xpath":"...","explanation":"..."}
文本加/text()，链接加/@href。`;
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n分析以下HTML，为"${fieldLabel}"字段生成XPath：\n${processed}`,
        system,
        aiConfig,
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
      setError(String(e));
    } finally {
      setAiLoading(null);
    }
  };

  return { aiEnabled, aiLoading, runBatchAi, runFieldAi };
}

/**
 * useWizardListRulesAi — WizardStep2ListRules 的 AI 逻辑 hook
 */
import { useState } from "react";

import { aiComplete, extractJson, preprocessHtml } from "@/lib/ai";
import { useAiStore } from "@/store/aiStore";

import type { FieldRule, WizardData } from "../ruleUtils";
import { readAiFieldMap, readAiXPathReply } from "../utils/aiSafeParse";
import { AI_SYSTEM_CATALOG_FIELDS, applyAiResult } from "../utils/wizardAiHelpers";

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
        `网站：${data.catalog_url}\n\n分析以下目录页 HTML，提取章节列表的章节名称、章节链接、更新日期的 XPath：\n${processed}`,
        AI_SYSTEM_CATALOG_FIELDS,
        aiConfig,
      );
      const parsed = readAiFieldMap(extractJson(reply));
      onChange({
        ...data,
        catalog_html: html,
        list_novel_name: applyAiResult(data.list_novel_name, parsed.list_novel_name),
        list_release_date: applyAiResult(data.list_release_date, parsed.list_release_date),
        list_release_url: applyAiResult(data.list_release_url, parsed.list_release_url),
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
这是一个【小说目录页】，页面列出的是章节列表（不是书籍列表）。
为字段"${fieldLabel}"生成最合适的XPath，严格输出JSON：{"xpath":"...","explanation":"..."}
文本加/text()，链接加/@href。注意：章节名称字段要匹配章节标题而非书名，章节链接字段要匹配章节页面链接而非书籍链接。`;
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n这是小说目录页，分析HTML，为"${fieldLabel}"字段生成XPath：\n${processed}`,
        system,
        aiConfig,
      );
      const parsed = readAiXPathReply(extractJson(reply));
      const xpath = parsed.xpath;
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

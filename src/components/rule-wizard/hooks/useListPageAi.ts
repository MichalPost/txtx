/**
 * useListPageAi — WizardStep1UpdateList 的 AI 逻辑 hook
 */
import { useState } from "react";
import { useAiStore } from "@/store/aiStore";
import { aiComplete, preprocessHtml, extractJson } from "@/lib/ai";
import { applyAiResult, AI_SYSTEM_LIST_FIELDS } from "../utils/wizardAiHelpers";
import { mergeBooks } from "../utils/xpathEval";
import { buildXPathFromRule } from "../ruleUtils";
import { evalXPathAll } from "../utils/xpathEval";
import type { WizardData, FieldRule, UpdateListBookItem } from "../ruleUtils";

const AI_PAGINATION_SYSTEM = `你是专门分析中文小说网站 HTML 结构的专家。
分析列表页HTML，检测是否存在分页，输出JSON，不含其他内容：
{
  "has_pagination": true/false,
  "page_url_mode": "suffix" 或 "insert",
  "page_total": 数字（总页数，如不确定写2）,
  "page_insert_part": "插入URL的分页片段，如 _2 或 ?page=2",
  "explanation": "简短说明"
}
规则：若URL末尾加 _2/_3 等数字后缀实现分页则用suffix，若URL中间某处插入则用insert。`;

function reparseBooks(data: WizardData): UpdateListBookItem[] {
  const html = data.update_list_html;
  if (!html) return [];
  const nameXPath = buildXPathFromRule(data.list_novel_name);
  const urlXPath  = buildXPathFromRule(data.list_release_url);
  const dateXPath = buildXPathFromRule(data.list_release_date);
  if (!nameXPath || !urlXPath) return [];
  const names = evalXPathAll(html, nameXPath);
  const urls  = evalXPathAll(html, urlXPath);
  const dates = dateXPath ? evalXPathAll(html, dateXPath) : [];
  return mergeBooks(names, urls, dates, data.update_list_url);
}

export function useListPageAi(
  data: WizardData,
  onChange: (d: WizardData) => void,
  ensureHtml: () => Promise<string>,
) {
  const aiEnabled = useAiStore((s) => s.config.enabled);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiError, setAiError] = useState("");

  const runBatchAi = async () => {
    if (!aiEnabled) return;
    setAiLoading("batch");
    setAiError("");
    try {
      const html = await ensureHtml();
      const aiConfig = useAiStore.getState().activeConfig();
      const processed = preprocessHtml(html);
      const reply = await aiComplete(
        `网站：${data.update_list_url}\n\n分析以下最近更新列表页 HTML，为3个字段生成 XPath：\n${processed}`,
        AI_SYSTEM_LIST_FIELDS, aiConfig,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;
      const next: WizardData = {
        ...data,
        update_list_html: html,
        list_novel_name:   applyAiResult(data.list_novel_name,   parsed?.list_novel_name),
        list_release_date: applyAiResult(data.list_release_date, parsed?.list_release_date),
        list_release_url:  applyAiResult(data.list_release_url,  parsed?.list_release_url),
      };
      onChange({ ...next, update_books: reparseBooks(next) });
    } catch (e) { setAiError(String(e)); }
    finally { setAiLoading(null); }
  };

  const runFieldAi = async (
    key: "list_novel_name" | "list_release_date" | "list_release_url",
    label: string,
  ) => {
    if (!aiEnabled) return;
    setAiLoading(key);
    setAiError("");
    try {
      const html = await ensureHtml();
      const aiConfig = useAiStore.getState().activeConfig();
      const processed = preprocessHtml(html);
      const system = `你是专门分析中文小说网站HTML结构的专家。
为字段"${label}"生成最合适的XPath，严格输出JSON：{"xpath":"...","explanation":"..."}
文本加/text()，链接加/@href。`;
      const reply = await aiComplete(
        `网站：${data.update_list_url}\n\n分析HTML，为"${label}"字段生成XPath：\n${processed}`,
        system, aiConfig,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;
      const xpath: string = parsed?.xpath ?? "";
      const rule: FieldRule = { ...data[key], mode: "ai", xpath };
      const next = { ...data, update_list_html: html, [key]: rule };
      onChange({ ...next, update_books: reparseBooks(next) });
    } catch (e) { setAiError(String(e)); }
    finally { setAiLoading(null); }
  };

  const runPaginationAi = async () => {
    if (!aiEnabled) return;
    setAiLoading("pagination");
    setAiError("");
    try {
      const html = await ensureHtml();
      const aiConfig = useAiStore.getState().activeConfig();
      const processed = preprocessHtml(html);
      const reply = await aiComplete(
        `网站：${data.update_list_url}\n\n分析以下列表页 HTML，检测分页规则：\n${processed}`,
        AI_PAGINATION_SYSTEM, aiConfig,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;
      if (parsed) {
        onChange({
          ...data,
          update_list_html: html,
          has_pagination:   Boolean(parsed.has_pagination),
          page_url_mode:    (parsed.page_url_mode === "insert" ? "insert" : "suffix") as "suffix" | "insert",
          page_total:       Math.max(1, Number(parsed.page_total) || 2),
          page_insert_part: parsed.page_insert_part ?? data.page_insert_part,
        });
      }
    } catch (e) { setAiError(String(e)); }
    finally { setAiLoading(null); }
  };

  return { aiEnabled, aiLoading, aiError, setAiError, runBatchAi, runFieldAi, runPaginationAi };
}

/**
 * useCatalogAi — WizardStepCatalog 的 AI 逻辑 hook
 */
import { useState } from "react";

import { aiComplete, extractJson, preprocessHtml } from "@/lib/ai";
import { useAiStore } from "@/store/aiStore";

import {
  buildXPathFromRule,
  type ChapterListItem,
  type FieldRule,
  type WizardData,
} from "../ruleUtils";
import { readAiFieldMap, readAiXPathReply } from "../utils/aiSafeParse";
import { formatWizardActionError } from "../utils/wizardActionError";
import { AI_SYSTEM_CATALOG_FIELDS, applyAiResult } from "../utils/wizardAiHelpers";
import { evalXPathAll, resolveUrl } from "../utils/xpathEval";

function reparseChapters(data: WizardData): ChapterListItem[] {
  const html = data.catalog_html;
  if (!html) return [];
  const titleXPath = buildXPathFromRule(data.list_novel_name);
  const urlXPath = buildXPathFromRule(data.list_release_url);
  const dateXPath = buildXPathFromRule(data.list_release_date);
  if (!urlXPath) return [];
  const titles = titleXPath ? evalXPathAll(html, titleXPath) : [];
  const urls = evalXPathAll(html, urlXPath);
  const dates = dateXPath ? evalXPathAll(html, dateXPath) : [];
  return urls
    .map((rawUrl, i) => ({
      title: titles[i]?.trim() || `章节 ${i + 1}`,
      url: resolveUrl(rawUrl.trim(), data.catalog_url),
      date: dates[i]?.trim(),
    }))
    .filter((c) => c.url);
}

export function useCatalogAi(
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
        `网站：${data.catalog_url}\n\n分析以下目录页 HTML，提取章节列表的章节名称、章节链接、更新日期的 XPath：\n${processed}`,
        AI_SYSTEM_CATALOG_FIELDS,
        aiConfig,
      );
      const parsed = readAiFieldMap(extractJson(reply));
      const next: WizardData = {
        ...data,
        catalog_html: html,
        list_novel_name: applyAiResult(data.list_novel_name, parsed.list_novel_name),
        list_release_date: applyAiResult(data.list_release_date, parsed.list_release_date),
        list_release_url: applyAiResult(data.list_release_url, parsed.list_release_url),
      };
      const chapters = reparseChapters(next);
      onChange({
        ...next,
        chapter_items: chapters,
        chapter_test_url: chapters[0]?.url ?? next.chapter_test_url,
      });
    } catch (error) {
      setAiError(formatWizardActionError("AI 批量分析目录页", error));
    } finally {
      setAiLoading(null);
    }
  };

  const runFieldAi = async (
    key: "list_novel_name" | "list_release_date" | "list_release_url" | "chap_intro",
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
这是一个【小说目录页】，页面列出的是章节列表（不是书籍列表）。
为字段"${label}"生成最合适的XPath，严格输出JSON：{"xpath":"...","explanation":"..."}
文本加/text()，链接加/@href。注意：章节名称字段要匹配章节标题而非书名，章节链接字段要匹配章节页面链接而非书籍链接。`;
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n这是小说目录页，分析HTML，为"${label}"字段生成XPath：\n${processed}`,
        system,
        aiConfig,
      );
      const parsed = readAiXPathReply(extractJson(reply));
      const xpath = parsed.xpath;
      const rule: FieldRule = { ...data[key], mode: "ai", xpath };
      const next = { ...data, catalog_html: html, [key]: rule };
      const chapters = reparseChapters(next);
      onChange({
        ...next,
        chapter_items: chapters,
        chapter_test_url: chapters[0]?.url ?? next.chapter_test_url,
      });
    } catch (error) {
      setAiError(formatWizardActionError(`AI 分析${label}`, error));
    } finally {
      setAiLoading(null);
    }
  };

  return { aiEnabled, aiLoading, aiError, setAiError, runBatchAi, runFieldAi };
}

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
import { AI_SYSTEM_LIST_FIELDS, applyAiResult } from "../utils/wizardAiHelpers";
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
        `网站：${data.catalog_url}\n\n分析以下目录页 HTML，为3个字段生成 XPath：\n${processed}`,
        AI_SYSTEM_LIST_FIELDS,
        aiConfig,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;
      const next: WizardData = {
        ...data,
        catalog_html: html,
        list_novel_name: applyAiResult(data.list_novel_name, parsed?.list_novel_name),
        list_release_date: applyAiResult(data.list_release_date, parsed?.list_release_date),
        list_release_url: applyAiResult(data.list_release_url, parsed?.list_release_url),
      };
      const chapters = reparseChapters(next);
      onChange({
        ...next,
        chapter_items: chapters,
        chapter_test_url: chapters[0]?.url ?? next.chapter_test_url,
      });
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAiLoading(null);
    }
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
        `网站：${data.catalog_url}\n\n分析HTML，为"${label}"字段生成XPath：\n${processed}`,
        system,
        aiConfig,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;
      const xpath: string = parsed?.xpath ?? "";
      const rule: FieldRule = { ...data[key], mode: "ai", xpath };
      const next = { ...data, catalog_html: html, [key]: rule };
      const chapters = reparseChapters(next);
      onChange({
        ...next,
        chapter_items: chapters,
        chapter_test_url: chapters[0]?.url ?? next.chapter_test_url,
      });
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAiLoading(null);
    }
  };

  return { aiEnabled, aiLoading, aiError, setAiError, runBatchAi, runFieldAi };
}

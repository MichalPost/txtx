import { useState } from "react";

import { aiComplete, extractJson, preprocessHtml } from "@/lib/ai";
import { apiFetchSource } from "@/lib/api/files";
import { useAiStore } from "@/store/aiStore";

import type { FieldRule, WizardData } from "../ruleUtils";
import { getAiFieldResult, getAiObject, getAiString } from "../utils/aiResponse";
import { formatWizardActionError } from "../utils/wizardActionError";

type FetchStatus = "idle" | "loading" | "ok" | "error";

const AI_SYSTEM = `你是专门分析中文小说网站 HTML 结构的专家。
分析【小说章节页】HTML，为以下字段生成XPath，严格输出JSON，不含其他内容：
{
  "chap_novel_name":  {"xpath":"...","explanation":"..."},
  "chap_chapter_url": {"xpath":"...","explanation":"..."},
  "chap_content":     {"xpath":"...","explanation":"..."},
  "chap_next_page":   {"xpath":"...","explanation":"..."}
}
字段说明：
- chap_novel_name：章节页顶部显示的【书名】（不是章节标题）
- chap_chapter_url：章节页中指向【其他章节的链接】（通常在目录按钮或章节导航中）
- chap_content：【正文内容】，优先找 id 含 content/txt/text 或 class 含 content/txt/text 的 div，文本加 /text()
- chap_next_page：【章节内分页"下一页"链接】，找"下一页"按钮的 href，没有分页则留空字符串
规则：优先用 id/class 属性，文本加 /text()，链接加 /@href。`;

export function applyAiResult(existing: FieldRule, result?: { xpath?: string }): FieldRule {
  const xpath = result?.xpath ?? "";
  if (!xpath) return existing;
  return { ...existing, mode: "ai", xpath };
}

export function detectNextPageXPath(html: string): string {
  if (!html) return "";
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const candidates = [
      '//a[contains(text(),"下一页")]/@href',
      '//a[contains(text(),"下页")]/@href',
      '//a[contains(@class,"next")]/@href',
      '//a[contains(@id,"next")]/@href',
      '//a[@rel="next"]/@href',
      '//a[contains(@class,"nextpage")]/@href',
      '//a[contains(@class,"page-next")]/@href',
    ];
    for (const xpath of candidates) {
      try {
        const r = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const val = (r.singleNodeValue as Attr | null)?.value?.trim();
        if (val && val !== "#" && !val.startsWith("javascript")) return xpath;
      } catch {
        /* skip */
      }
    }
  } catch {
    /* ignore */
  }
  return "";
}

export function useChapterRulesStep(data: WizardData, onChange: (d: WizardData) => void) {
  const aiEnabled = useAiStore((s) => s.config.enabled);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [newFallback, setNewFallback] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(Boolean(data.chapter_next_page_xpath));
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>(data.chapter_html ? "ok" : "idle");
  const [fetchError, setFetchError] = useState("");
  const [nextPageDetected, setNextPageDetected] = useState(false);

  const chapterUrl = data.chapter_test_url || data.catalog_url;

  const handleFetch = async () => {
    const url = chapterUrl.trim();
    if (!url || url === "https://") return;
    setFetchStatus("loading");
    setFetchError("");
    setNextPageDetected(false);
    try {
      const html = await apiFetchSource(url);
      let nextPageXPath = data.chapter_next_page_xpath;
      let detected = false;
      if (!nextPageXPath) {
        nextPageXPath = detectNextPageXPath(html);
        if (nextPageXPath) detected = true;
      }
      onChange({
        ...data,
        chapter_html: html,
        chapter_test_url: url,
        chapter_next_page_xpath: nextPageXPath,
      });
      setFetchStatus("ok");
      if (detected) {
        setNextPageDetected(true);
        setShowAdvanced(true);
      }
    } catch (error) {
      setFetchError(formatWizardActionError("获取章节页面", error));
      setFetchStatus("error");
    }
  };

  const ensureChapHtml = async (): Promise<string> => {
    if (data.chapter_html) return data.chapter_html;
    const url = chapterUrl.trim();
    if (!url || url === "https://") throw new Error("请先获取章节页面");
    const html = await apiFetchSource(url);
    onChange({ ...data, chapter_html: html, chapter_test_url: url });
    setFetchStatus("ok");
    return html;
  };

  const runBatchAi = async () => {
    if (!aiEnabled) return;
    setAiLoading("batch");
    setErrorMsg("");
    try {
      const html = await ensureChapHtml();
      const aiConfig = useAiStore.getState().activeConfig();
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n分析以下章节页 HTML，生成字段的 XPath：\n${preprocessHtml(html)}`,
        AI_SYSTEM,
        aiConfig,
      );
      const parsed = getAiObject(extractJson(reply));
      const nextPageXPath = getAiFieldResult(parsed.chap_next_page)?.xpath ?? "";
      onChange({
        ...data,
        chapter_html: html,
        chap_novel_name: applyAiResult(data.chap_novel_name, getAiFieldResult(parsed.chap_novel_name)),
        chap_chapter_url: applyAiResult(
          data.chap_chapter_url,
          getAiFieldResult(parsed.chap_chapter_url),
        ),
        chap_content: applyAiResult(data.chap_content, getAiFieldResult(parsed.chap_content)),
        chapter_next_page_xpath: nextPageXPath || data.chapter_next_page_xpath,
      });
      if (nextPageXPath) setShowAdvanced(true);
    } catch (error) {
      setErrorMsg(formatWizardActionError("AI 批量分析章节页", error));
    } finally {
      setAiLoading(null);
    }
  };

  const runFieldAi = async (
    fieldKey: "chap_novel_name" | "chap_chapter_url" | "chap_content",
    fieldLabel: string,
  ) => {
    if (!aiEnabled) return;
    setAiLoading(fieldKey);
    setErrorMsg("");
    try {
      const html = await ensureChapHtml();
      const aiConfig = useAiStore.getState().activeConfig();
      const system = `你是专门分析中文小说网站HTML结构的专家。这是一个【章节正文页面】。
为字段"${fieldLabel}"生成最合适的XPath，严格输出JSON：{"xpath":"...","explanation":"..."}
文本加/text()，链接加/@href。正文内容优先找 id/class 含 content/txt/text 的容器。`;
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n分析以下章节页HTML，为"${fieldLabel}"字段生成XPath：\n${preprocessHtml(html)}`,
        system,
        aiConfig,
      );
      const parsed = getAiObject(extractJson(reply));
      onChange({
        ...data,
        chapter_html: html,
        [fieldKey]: {
          ...data[fieldKey],
          mode: "ai",
          xpath: getAiString(parsed.xpath),
        } as FieldRule,
      });
    } catch (error) {
      setErrorMsg(formatWizardActionError(`AI 分析${fieldLabel}`, error));
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

  const handleChapterUrlChange = (value: string) => {
    onChange({ ...data, chapter_test_url: value, chapter_html: "" });
    setFetchStatus("idle");
    setFetchError("");
    setErrorMsg("");
    setNextPageDetected(false);
  };

  const undoDetectedNextPage = () => {
    onChange({ ...data, chapter_next_page_xpath: "" });
    setNextPageDetected(false);
  };

  return {
    aiEnabled,
    aiLoading,
    errorMsg,
    newFallback,
    setNewFallback,
    showAdvanced,
    setShowAdvanced,
    fetchStatus,
    fetchError,
    nextPageDetected,
    chapterUrl,
    handleFetch,
    runBatchAi,
    runFieldAi,
    addFallback,
    removeFallback,
    handleChapterUrlChange,
    undoDetectedNextPage,
  };
}

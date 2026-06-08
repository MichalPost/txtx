import { useCallback, useMemo, useState } from "react";

import { validateXPath } from "@/lib/ai";
import { apiFetchSource } from "@/lib/api/files";

import { buildBookNameXPath } from "../components/BookNameConfig";
import { useCatalogAi } from "./useCatalogAi";
import { buildXPathFromRule, detectCharset, type FieldRule, type WizardData } from "../ruleUtils";
import { evalXPathAll, resolveUrl } from "../utils/xpathEval";

type FetchStatus = "idle" | "loading" | "ok" | "error";

export const CATALOG_COMMON_URL_RULES = [
  { label: "-- 常用链接规则 --", value: "" },
  { label: "li > a href", value: "//li/a/@href" },
  { label: "ul li a href", value: "//ul/li/a/@href" },
  { label: "div.list a href", value: "//div[contains(@class,'list')]//a/@href" },
  { label: "div.chapter a href", value: "//div[contains(@class,'chapter')]//a/@href" },
  { label: "div.catalog a href", value: "//div[contains(@class,'catalog')]//a/@href" },
  { label: "dl dd a href", value: "//dl//dd/a/@href" },
  { label: "table td a href", value: "//table//td/a/@href" },
];

function reparseChapters(data: WizardData, html: string, baseUrl: string) {
  const titleXPath = buildXPathFromRule(data.list_novel_name);
  const urlXPath = buildXPathFromRule(data.list_release_url);
  const dateXPath = buildXPathFromRule(data.list_release_date);
  const titles = titleXPath ? evalXPathAll(html, titleXPath) : [];
  const urls = urlXPath ? evalXPathAll(html, urlXPath) : [];
  const dates = dateXPath ? evalXPathAll(html, dateXPath) : [];
  return urls
    .map((rawUrl, i) => ({
      title: titles[i]?.trim() || `章节 ${i + 1}`,
      url: resolveUrl(rawUrl.trim(), baseUrl),
      date: dates[i]?.trim(),
    }))
    .filter((c) => c.url);
}

export function useCatalogStep(data: WizardData, onChange: (d: WizardData) => void) {
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>(data.catalog_html ? "ok" : "idle");
  const [fetchError, setFetchError] = useState("");
  const [showSource, setShowSource] = useState(false);
  const [autoMatchLoading, setAutoMatchLoading] = useState(false);
  const [bookNameTest, setBookNameTest] = useState<{ count: number; sample: string } | null>(null);

  const ensureHtml = useCallback(async (): Promise<string> => {
    if (data.catalog_html) return data.catalog_html;
    const url = data.catalog_url.trim();
    if (!url || url === "https://") throw new Error("请先填写目录页链接");
    const html = await apiFetchSource(url);
    const detectedEncoding = detectCharset(html);
    onChange({ ...data, catalog_html: html, encoding: data.encoding || detectedEncoding });
    return html;
  }, [data, onChange]);

  const { aiEnabled, aiLoading, aiError, setAiError, runBatchAi, runFieldAi } = useCatalogAi(
    data,
    onChange,
    ensureHtml,
  );

  const handleFetch = async () => {
    const url = data.catalog_url.trim();
    if (!url || url === "https://") return;
    setFetchStatus("loading");
    setFetchError("");
    try {
      const html = await apiFetchSource(url);
      const detectedEncoding = detectCharset(html);
      const chapters = reparseChapters(data, html, url);
      const firstUrl = chapters[0]?.url ?? data.chapter_test_url;
      onChange({
        ...data,
        catalog_html: html,
        chapter_items: chapters,
        chapter_test_url: firstUrl,
        encoding: data.encoding || detectedEncoding,
      });
      setFetchStatus("ok");
    } catch (e) {
      setFetchError(String(e));
      setFetchStatus("error");
    }
  };

  const patchRule = useCallback(
    async (key: "list_novel_name" | "list_release_date" | "list_release_url", rule: FieldRule) => {
      const next = { ...data, [key]: rule };
      const html = next.catalog_html;
      if (!html) {
        onChange(next);
        return;
      }
      const chapters = reparseChapters(next, html, next.catalog_url);
      const firstUrl = chapters[0]?.url ?? next.chapter_test_url;
      onChange({ ...next, chapter_items: chapters, chapter_test_url: firstUrl });
    },
    [data, onChange],
  );

  const runAutoMatch = async () => {
    setAutoMatchLoading(true);
    setAiError("");
    try {
      const html = await ensureHtml();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const candidates = [
        "//div[contains(@class,'list')]//a/@href",
        "//div[contains(@class,'chapter')]//a/@href",
        "//div[contains(@class,'catalog')]//a/@href",
        "//ul[contains(@class,'list')]//a/@href",
        "//ul//li/a/@href",
        "//dl//dd/a/@href",
        "//table//td/a/@href",
      ];
      let bestXpath = "";
      let bestCount = 0;
      for (const xpath of candidates) {
        try {
          const snap = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (snap.snapshotLength > bestCount) {
            bestCount = snap.snapshotLength;
            bestXpath = xpath;
          }
        } catch {
          /* skip */
        }
      }
      const rule: FieldRule = {
        ...data.list_release_url,
        mode: "xpath",
        xpath: bestXpath || data.list_release_url.xpath,
      };
      const next = { ...data, catalog_html: html, list_release_url: rule };
      const urlXPath = buildXPathFromRule(next.list_release_url);
      const urls = urlXPath ? evalXPathAll(html, urlXPath) : [];
      const chapters = urls
        .map((rawUrl, i) => ({
          title: `章节 ${i + 1}`,
          url: resolveUrl(rawUrl.trim(), next.catalog_url),
          date: undefined,
        }))
        .filter((c) => c.url);
      onChange({
        ...next,
        chapter_items: chapters,
        chapter_test_url: chapters[0]?.url ?? next.chapter_test_url,
      });
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAutoMatchLoading(false);
    }
  };

  const bookNamePreview = useMemo(() => buildBookNameXPath(data), [data]);

  const testBookName = () => {
    if (!data.catalog_html) {
      setAiError("请先获取页面");
      return;
    }
    if (!bookNamePreview) {
      setBookNameTest(null);
      return;
    }
    const v = validateXPath(data.catalog_html, bookNamePreview);
    setBookNameTest({ count: v.count, sample: v.samples[0] ?? "" });
  };

  const handleUrlChange = (value: string) => {
    onChange({
      ...data,
      catalog_url: value,
      catalog_html: "",
      chapter_items: [],
    });
    setFetchStatus("idle");
  };

  const toggleSource = async () => {
    if (!data.catalog_html) {
      try {
        await ensureHtml();
      } catch {
        /* ignore */
      }
    }
    setShowSource((v) => !v);
  };

  return {
    fetchStatus,
    fetchError,
    showSource,
    autoMatchLoading,
    bookNameTest,
    aiEnabled,
    aiLoading,
    aiError,
    runBatchAi,
    runFieldAi,
    patchRule,
    runAutoMatch,
    bookNamePreview,
    testBookName,
    handleFetch,
    handleUrlChange,
    toggleSource,
  };
}

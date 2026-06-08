import { useCallback, useMemo, useState } from "react";

import { validateXPath } from "@/lib/ai";
import { apiFetchSource } from "@/lib/api/files";

import { buildBookNameXPath } from "../components/BookNameConfig";
import { useListPageAi } from "./useListPageAi";
import {
  buildXPathFromRule,
  detectCharset,
  type FieldRule,
  type UpdateListBookItem,
  type WizardData,
} from "../ruleUtils";
import { detectPagination } from "../utils/paginationDetect";
import { evalXPathAll, mergeBooks } from "../utils/xpathEval";

type FetchStatus = "idle" | "loading" | "ok" | "error";

export const UPDATE_LIST_COMMON_URL_RULES = [
  { label: "-- 常用链接规则 --", value: "" },
  { label: "li > a href", value: "//li/a/@href" },
  { label: "ul li a href", value: "//ul/li/a/@href" },
  { label: "div.list a href", value: "//div[contains(@class,'list')]//a/@href" },
  { label: "div.update a href", value: "//div[contains(@class,'update')]//a/@href" },
  { label: "table td a href", value: "//table//td/a/@href" },
  { label: "dt a href", value: "//dt/a/@href" },
];

export function reparseUpdateBooks(data: WizardData): UpdateListBookItem[] {
  const html = data.update_list_html;
  if (!html) return [];
  const nameXPath = buildXPathFromRule(data.list_novel_name);
  const urlXPath = buildXPathFromRule(data.list_release_url);
  const dateXPath = buildXPathFromRule(data.list_release_date);
  if (!nameXPath || !urlXPath) return [];
  const names = evalXPathAll(html, nameXPath);
  const urls = evalXPathAll(html, urlXPath);
  const dates = dateXPath ? evalXPathAll(html, dateXPath) : [];
  return mergeBooks(names, urls, dates, data.update_list_url);
}

export function useUpdateListStep(data: WizardData, onChange: (d: WizardData) => void) {
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [fetchError, setFetchError] = useState("");
  const [showSource, setShowSource] = useState(false);
  const [autoMatchLoading, setAutoMatchLoading] = useState(false);
  const [paginationDetected, setPaginationDetected] = useState<{
    method: string;
    page_total: number;
    page_insert_part: string;
  } | null>(null);
  const [bookNameTest, setBookNameTest] = useState<{ count: number; sample: string } | null>(null);

  const ensureHtml = useCallback(async (): Promise<string> => {
    if (data.update_list_html) return data.update_list_html;
    const url = data.update_list_url.trim();
    if (!url || url === "https://") throw new Error("请先填写最近更新列表页网址");
    const html = await apiFetchSource(url);
    onChange({ ...data, update_list_html: html });
    return html;
  }, [data, onChange]);

  const {
    aiEnabled,
    aiLoading,
    aiError,
    setAiError,
    runBatchAi,
    runFieldAi,
    runPaginationAi,
  } = useListPageAi(data, onChange, ensureHtml);

  const handleFetch = async () => {
    const url = data.update_list_url.trim();
    if (!url || url === "https://") return;
    setFetchStatus("loading");
    setFetchError("");
    setPaginationDetected(null);
    try {
      const html = await apiFetchSource(url);
      const detectedEncoding = detectCharset(html);
      const books = reparseUpdateBooks({ ...data, update_list_html: html });

      let paginationPatch: Partial<WizardData> = {};
      const detected = detectPagination(html, url);
      if (detected && !data.has_pagination) {
        paginationPatch = {
          has_pagination: true,
          page_url_mode: detected.page_url_mode,
          page_insert_part: detected.page_insert_part,
          page_total: detected.page_total,
        };
      }
      if (detected) setPaginationDetected(detected);

      onChange({
        ...data,
        ...paginationPatch,
        update_list_html: html,
        update_books: books,
        encoding: data.encoding || detectedEncoding,
      });
      setFetchStatus("ok");
    } catch (e) {
      setFetchError(String(e));
      setFetchStatus("error");
    }
  };

  const patchRule = useCallback(
    (key: "list_novel_name" | "list_release_date" | "list_release_url", rule: FieldRule) => {
      const next = { ...data, [key]: rule };
      onChange({ ...next, update_books: reparseUpdateBooks(next) });
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
        "//div[contains(@class,'update')]//a/@href",
        "//div[contains(@class,'list')]//a/@href",
        "//ul[contains(@class,'list')]//a/@href",
        "//ul//li/a/@href",
        "//dl//dt/a/@href",
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
      const next = { ...data, update_list_html: html, list_release_url: rule };
      onChange({ ...next, update_books: reparseUpdateBooks(next) });
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAutoMatchLoading(false);
    }
  };

  const bookNamePreview = useMemo(() => buildBookNameXPath(data), [data]);

  const testBookName = () => {
    if (!data.update_list_html) {
      setAiError("请先获取页面");
      return;
    }
    if (!bookNamePreview) {
      setBookNameTest(null);
      return;
    }
    const v = validateXPath(data.update_list_html, bookNamePreview);
    setBookNameTest({ count: v.count, sample: v.samples[0] ?? "" });
  };

  const handleUrlChange = (value: string) => {
    onChange({ ...data, update_list_url: value, update_list_html: "" });
    setFetchStatus("idle");
    setPaginationDetected(null);
  };

  const toggleSource = async () => {
    if (!data.update_list_html) {
      try {
        await ensureHtml();
      } catch {
        /* ignore */
      }
    }
    setShowSource((v) => !v);
  };

  const applyCommonUrlRule = (xpath: string) => {
    const rule: FieldRule = { ...data.list_release_url, mode: "xpath", xpath };
    const next = { ...data, list_release_url: rule };
    onChange({ ...next, update_books: reparseUpdateBooks(next) });
  };

  const undoDetectedPagination = () => {
    onChange({ ...data, has_pagination: false });
    setPaginationDetected(null);
  };

  return {
    fetchStatus,
    fetchError,
    showSource,
    autoMatchLoading,
    paginationDetected,
    bookNameTest,
    aiEnabled,
    aiLoading,
    aiError,
    runBatchAi,
    runFieldAi,
    runPaginationAi,
    patchRule,
    runAutoMatch,
    bookNamePreview,
    testBookName,
    handleFetch,
    handleUrlChange,
    toggleSource,
    applyCommonUrlRule,
    undoDetectedPagination,
  };
}

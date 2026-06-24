import { useState } from "react";

import { apiFetchSource } from "@/lib/api/files";

import { buildXPathFromRule, type UpdateListBookItem, type WizardData } from "../ruleUtils";
import { formatWizardActionError } from "../utils/wizardActionError";
import { applySelectedBook, resetSelectedBookContext } from "../wizardFlowUtils";

export function buildPageUrl(
  baseUrl: string,
  pageIndex: number,
  mode: "suffix" | "insert",
  insertPart: string,
): string {
  if (pageIndex <= 1) return baseUrl;
  const part = insertPart.trim();
  if (!part) return baseUrl;

  const numberedPart = part.replace(/\d+/, String(pageIndex));

  if (mode === "suffix") {
    try {
      const url = new URL(baseUrl);
      let pathname = url.pathname.replace(/[_-]\d+\/?$/, "").replace(/\/+$/, "");
      pathname = pathname + numberedPart;
      url.pathname = pathname;
      return url.toString();
    } catch {
      return baseUrl.replace(/[_-]\d+\/?$/, "") + numberedPart;
    }
  }

  try {
    const clean = baseUrl.replace(/[_-]\d+/, "");
    return clean.replace(/(\/$|\?|$)/, numberedPart + "$1");
  } catch {
    return baseUrl;
  }
}

function evalXPathAll(html: string, xpath: string): string[] {
  if (!xpath || !html) return [];
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const snap = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const out: string[] = [];
    for (let i = 0; i < snap.snapshotLength; i++) {
      const node = snap.snapshotItem(i);
      const v = (node?.textContent ?? (node as Attr | null)?.value ?? "").trim();
      if (v) out.push(v);
    }
    return out;
  } catch {
    return [];
  }
}

function resolveUrl(href: string, base: string): string {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

export function parseBooksFromHtml(
  html: string,
  data: WizardData,
  pageUrl: string,
): UpdateListBookItem[] {
  const nameXPath = buildXPathFromRule(data.list_novel_name);
  const urlXPath = buildXPathFromRule(data.list_release_url);
  const dateXPath = buildXPathFromRule(data.list_release_date);
  if (!nameXPath || !urlXPath) return [];
  const names = evalXPathAll(html, nameXPath);
  const urls = evalXPathAll(html, urlXPath);
  const dates = dateXPath ? evalXPathAll(html, dateXPath) : [];
  const len = Math.min(names.length, urls.length);
  const books: UpdateListBookItem[] = [];
  for (let i = 0; i < len; i++) {
    const name = names[i]?.trim();
    const url = resolveUrl(urls[i]?.trim() ?? "", pageUrl);
    if (name && url) books.push({ name, url, date: dates[i]?.trim() });
  }
  return books;
}

export function useSelectBookStep(data: WizardData, onChange: (d: WizardData) => void) {
  const books = data.update_books;
  const hasBooks = books.length > 0;
  const hasPagination = data.has_pagination && data.page_total > 1;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageBooks, setPageBooks] = useState<UpdateListBookItem[] | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  const displayBooks = pageBooks ?? books;
  const currentPageUrl = buildPageUrl(
    data.update_list_url,
    currentPage,
    data.page_url_mode,
    data.page_insert_part,
  );

  const fetchPage = async (pageIndex: number) => {
    if (pageIndex === 1) {
      setPageBooks(null);
      setCurrentPage(1);
      setPageError("");
      return;
    }
    setPageLoading(true);
    setPageError("");
    try {
      const pageUrl = buildPageUrl(
        data.update_list_url,
        pageIndex,
        data.page_url_mode,
        data.page_insert_part,
      );
      const html = await apiFetchSource(pageUrl);
      setPageBooks(parseBooksFromHtml(html, data, pageUrl));
      setCurrentPage(pageIndex);
    } catch (error) {
      setPageError(formatWizardActionError(`获取第 ${pageIndex} 页书籍列表`, error));
    } finally {
      setPageLoading(false);
    }
  };

  const selectBook = (book: UpdateListBookItem) => {
    setPageError("");
    onChange(applySelectedBook(data, book));
  };

  const setCatalogUrl = (value: string) => {
    setPageError("");
    onChange(resetSelectedBookContext(data, value));
  };

  return {
    hasBooks,
    hasPagination,
    currentPage,
    currentPageUrl,
    pageBooks,
    pageLoading,
    pageError,
    displayBooks,
    fetchPage,
    selectBook,
    setCatalogUrl,
  };
}

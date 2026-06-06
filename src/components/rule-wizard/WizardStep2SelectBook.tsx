/**
 * Step 2 — 选择书籍 → 确认目录链接
 *
 * 展示 Step 1 解析出的书籍列表，用户点选一本后
 * 目录页 URL 自动填入 catalog_url，也可手动修改。
 * 如果上一步设定了分页，可以切换页面重新拉取书籍列表。
 */
import { useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Globe,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { apiFetchSource } from "@/lib/api/files";

import { buildXPathFromRule, type UpdateListBookItem, type WizardData } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

// ─── Page URL builder ─────────────────────────────────────────────────────────

function buildPageUrl(
  baseUrl: string,
  pageIndex: number,
  mode: "suffix" | "insert",
  insertPart: string,
): string {
  if (pageIndex <= 1) return baseUrl;
  const part = insertPart.trim();
  if (!part) return baseUrl;

  // Replace any existing number in the insert part template with the new page number
  const numberedPart = part.replace(/\d+/, String(pageIndex));

  if (mode === "suffix") {
    // Append/replace suffix before query string / hash
    try {
      const url = new URL(baseUrl);
      // Remove the previous suffix (anything after the last path segment that looks like a page number)
      let pathname = url.pathname.replace(/[_-]\d+\/?$/, "").replace(/\/+$/, "");
      pathname = pathname + numberedPart;
      url.pathname = pathname;
      return url.toString();
    } catch {
      return baseUrl.replace(/[_-]\d+\/?$/, "") + numberedPart;
    }
  } else {
    // insert mode: replace in the URL
    try {
      // Remove an existing insert part pattern, then add the new one
      const clean = baseUrl.replace(/[_-]\d+/, "");
      return clean.replace(/(\/$|\?|$)/, numberedPart + "$1");
    } catch {
      return baseUrl;
    }
  }
}

// ─── XPath eval helper (mirrors Step 1) ─────────────────────────────────────

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

function parseBooksFromHtml(html: string, data: WizardData, pageUrl: string): UpdateListBookItem[] {
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

export function WizardStep2SelectBook({ data, onChange }: Props) {
  const books = data.update_books;
  const hasBooks = books.length > 0;
  const hasPagination = data.has_pagination && data.page_total > 1;

  // Current page index in this step (1-based), independent from what was fetched in step 1
  const [currentPage, setCurrentPage] = useState(1);
  const [pageBooks, setPageBooks] = useState<UpdateListBookItem[] | null>(null); // null = use data.update_books
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  const displayBooks = pageBooks ?? books;

  const fetchPage = async (pageIndex: number) => {
    if (pageIndex === 1) {
      // Page 1 is already in data.update_books
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
      const parsed = parseBooksFromHtml(html, data, pageUrl);
      setPageBooks(parsed);
      setCurrentPage(pageIndex);
    } catch (e) {
      setPageError(String(e));
    } finally {
      setPageLoading(false);
    }
  };

  const selectBook = (book: UpdateListBookItem) => {
    onChange({
      ...data,
      selected_book_name: book.name,
      selected_book_url: book.url,
      catalog_url: book.url,
      // Clear cached catalog HTML so Step 3 will re-fetch for the new URL
      catalog_html: "",
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Instruction ─────────────────────────────────────────────────── */}
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3"
        style={{
          background: "var(--color-accent-muted)",
          borderLeft: "2px solid var(--color-accent)",
        }}
      >
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>
            第二步：选择目标书籍
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            从上一步解析的书籍列表中选择一本，其目录页链接将自动填入。后续步骤将针对这本书的目录页和章节页配置解析规则。
          </p>
        </div>
      </div>

      {/* ── No books fallback ────────────────────────────────────────────── */}
      {!hasBooks && !pageBooks && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span>上一步未解析到书籍列表，请先回到第一步配置规则。</span>
            <span style={{ color: "var(--color-text-muted)" }}>
              或者直接在下方手动填入目录页链接，跳过选书步骤。
            </span>
          </div>
        </div>
      )}

      {/* ── Selected book indicator ──────────────────────────────────────── */}
      {data.selected_book_name && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">已选：{data.selected_book_name}</span>
        </div>
      )}

      {/* ── Pagination controls ──────────────────────────────────────────── */}
      {hasPagination && (hasBooks || pageBooks) && (
        <div
          className="flex items-center gap-2 rounded-xl border px-3 py-2"
          style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
        >
          <span className="flex-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            第 {currentPage} / {data.page_total} 页
            {currentPage > 1 && (
              <span
                className="ml-1.5 font-mono text-[10px]"
                style={{ color: "var(--color-text-subtle)" }}
              >
                {buildPageUrl(
                  data.update_list_url,
                  currentPage,
                  data.page_url_mode,
                  data.page_insert_part,
                )}
              </span>
            )}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fetchPage(currentPage - 1)}
            disabled={currentPage <= 1 || pageLoading}
          >
            <ChevronLeft className="h-3 w-3" />
            上一页
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fetchPage(currentPage + 1)}
            disabled={currentPage >= data.page_total || pageLoading}
          >
            {pageLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            下一页
          </Button>
          {currentPage > 1 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fetchPage(1)}
              disabled={pageLoading}
              title="回到第一页"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {/* ── Page fetch error ──────────────────────────────────────────────── */}
      {pageError && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{pageError}</span>
        </div>
      )}

      {/* ── Book list ────────────────────────────────────────────────────── */}
      {(displayBooks.length > 0 || pageLoading) && (
        <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-0.5">
          {pageLoading ? (
            <div
              className="flex items-center justify-center gap-2 py-8 text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-accent)" }} />
              正在拉取第 {currentPage + 1} 页书籍列表...
            </div>
          ) : (
            displayBooks.map((book, i) => (
              <BookCard
                key={i}
                book={book}
                index={i}
                selected={book.url === data.selected_book_url}
                onSelect={() => selectBook(book)}
              />
            ))
          )}
        </div>
      )}

      {/* ── Catalog URL (manual edit / fallback) ─────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            目录页链接 <span style={{ color: "var(--color-danger)" }}>*</span>
          </label>
        </div>
        <Input
          placeholder="https://example.com/novel/12345/"
          value={data.catalog_url}
          onChange={(e) => onChange({ ...data, catalog_url: e.target.value, catalog_html: "" })}
        />
        <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          点击上方书籍卡片可自动填入，也可直接粘贴目录页地址
        </p>
      </div>
    </div>
  );
}

// ─── BookCard ─────────────────────────────────────────────────────────────────

function BookCard({
  book,
  index,
  selected,
  onSelect,
}: {
  book: UpdateListBookItem;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-all"
      style={{
        background: selected
          ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))"
          : hovered
            ? "var(--color-surface-1)"
            : "var(--color-surface)",
        borderColor: selected
          ? "var(--color-accent)"
          : hovered
            ? "var(--color-border-hover)"
            : "var(--color-border)",
        transform: hovered && !selected ? "translateY(-1px)" : "none",
        boxShadow: hovered ? "var(--shadow-sm)" : "none",
        transition: "all 140ms ease",
      }}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Index badge */}
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{
          background: selected ? "var(--color-accent)" : "var(--color-surface-2)",
          color: selected ? "#fff" : "var(--color-text-subtle)",
          border: "1px solid var(--color-border)",
        }}
      >
        {index + 1}
      </span>

      {/* Icon */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: selected
            ? "color-mix(in srgb, var(--color-accent) 15%, var(--color-surface-1))"
            : "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
        }}
      >
        <BookOpen
          className="h-3.5 w-3.5"
          style={{ color: selected ? "var(--color-accent)" : "var(--color-text-subtle)" }}
        />
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className="truncate text-xs font-medium"
          style={{ color: selected ? "var(--color-accent)" : "var(--color-text)" }}
        >
          {book.name}
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="truncate font-mono text-xs"
            style={{ color: "var(--color-text-subtle)", fontSize: 10 }}
            title={book.url}
          >
            {book.url.replace(/^https?:\/\/[^/]+/, "") || book.url}
          </span>
          {book.date && (
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-xs"
              style={{
                background: "var(--color-surface-2)",
                color: "var(--color-text-subtle)",
                fontSize: 10,
              }}
            >
              {book.date}
            </span>
          )}
        </div>
      </div>

      {/* Right indicator */}
      <div className="shrink-0">
        {selected ? (
          <CheckCircle2 className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
        ) : (
          <ChevronRight
            className="h-4 w-4 opacity-40"
            style={{ color: "var(--color-text-subtle)" }}
          />
        )}
      </div>
    </div>
  );
}

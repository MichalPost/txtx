/**
 * Step 1 — 最近更新列表页
 *
 * 合并了"输入 URL → 拉取 HTML → 配置三条规则 + 分页 → 实时预览书籍列表"
 * 一步完成，用户看到正确的书籍列表后直接进入第二步选书。
 */
import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Globe, Search, Loader2, CheckCircle2, AlertCircle,
  RefreshCw, ChevronDown, ChevronUp,
  Sparkles, Code2,
} from "lucide-react";import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { FieldRuleEditor } from "./FieldRuleEditor";
import { apiFetchSource } from "@/lib/api/files";
import { aiComplete, preprocessHtml, extractJson, validateXPath } from "@/lib/ai";
import { useAiStore } from "@/store/aiStore";
import { buildXPathFromRule, detectCharset } from "./ruleUtils";
import type { WizardData, FieldRule, UpdateListBookItem } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

type FetchStatus = "idle" | "loading" | "ok" | "error";

// ─── Common rule presets ───────────────────────────────────────────────────────

const COMMON_URL_RULES = [
  { label: "-- 常用链接规则 --", value: "" },
  { label: "li > a href",               value: "//li/a/@href" },
  { label: "ul li a href",              value: "//ul/li/a/@href" },
  { label: "div.list a href",           value: "//div[contains(@class,'list')]//a/@href" },
  { label: "div.update a href",         value: "//div[contains(@class,'update')]//a/@href" },
  { label: "table td a href",           value: "//table//td/a/@href" },
  { label: "dt a href",                 value: "//dt/a/@href" },
];

const PAGE_URL_MODES = [
  { label: "插入后缀页", value: "suffix" },
  { label: "插入链接部分", value: "insert" },
];

const AI_SYSTEM = `你是专门分析中文小说网站 HTML 结构的专家。
分析最近更新列表页HTML，为以下3个字段生成XPath，严格输出JSON，不含其他内容：
{
  "list_novel_name":   {"xpath":"...","explanation":"..."},
  "list_release_date": {"xpath":"...","explanation":"..."},
  "list_release_url":  {"xpath":"...","explanation":"..."}
}
规则：优先用 id/class 属性，文本加 /text()，链接加 /@href，用 // 全局路径。无把握的字段 xpath 留空字符串。`;

// ─── Pagination auto-detection ────────────────────────────────────────────────

/**
 * Detect pagination from a fetched list page.
 *
 * Strategy:
 * 1. Collect all <a href> links that share the same origin+path-prefix as
 *    the current URL but differ by an incrementing number segment.
 * 2. Match against a priority list of common URL patterns used by Chinese
 *    novel sites (covers ~95% of real-world cases).
 * 3. Return the detected template + total pages, or null when not found.
 *
 * Supported patterns (examples):
 *   suffix-digit   : /top/lastupdate_1/  →  _N/     (most common)
 *   suffix-digit2  : /list_1.html        →  _N.html
 *   suffix-digit3  : /index_2.html       →  _N.html  (page 1 has no digit)
 *   query-page     : ?page=1             →  ?page=N
 *   query-p        : ?p=2                →  ?p=N
 *   path-page      : /page/2/            →  /page/N/
 *   path-num       : /1.html             →  /N.html
 */
export interface PaginationDetectResult {
  has_pagination: true;
  page_url_mode:  "suffix" | "insert";
  page_insert_part: string;   // the fragment for page 2, e.g. "_2" or "?page=2"
  page_total:     number;
  method:         string;     // human-readable description shown in UI
}

export function detectPagination(
  html: string,
  currentUrl: string,
): PaginationDetectResult | null {
  if (!html || !currentUrl) return null;

  let base: URL;
  try { base = new URL(currentUrl); } catch { return null; }

  // ── Collect all <a href> from the page ──────────────────────────────────────
  const doc = new DOMParser().parseFromString(html, "text/html");
  const anchors = Array.from(doc.querySelectorAll("a[href]"));
  const hrefs: string[] = [];
  for (const a of anchors) {
    const raw = a.getAttribute("href") ?? "";
    if (!raw || raw.startsWith("#") || raw.startsWith("javascript")) continue;
    try {
      const abs = new URL(raw, currentUrl).href;
      if (abs.startsWith(base.origin)) hrefs.push(abs);
    } catch { /* skip */ }
  }

  // ── Pattern matchers ────────────────────────────────────────────────────────
  // Each matcher returns { insert_part, total } or null.
  // They are tried in priority order.

  // Helper: given a set of numbers found in matching URLs, pick max
  function maxPage(nums: number[]): number {
    return Math.max(...nums.filter((n) => n >= 2 && n <= 999));
  }

  // 1. Query string: ?page=N or ?p=N or ?pageNum=N
  for (const param of ["page", "p", "pagenum", "pageNo", "pn"]) {
    const re = new RegExp(`[?&]${param}=(\\d+)`, "i");
    const nums: number[] = [];
    for (const h of hrefs) {
      if (h.split("?")[0] === currentUrl.split("?")[0] || h.startsWith(base.origin + base.pathname)) {
        const m = h.match(re);
        if (m) nums.push(Number(m[1]));
      }
    }
    if (nums.length >= 1) {
      const total = maxPage(nums);
      if (total >= 2) {
        const sep = currentUrl.includes("?") ? `&${param}=2` : `?${param}=2`;
        return {
          has_pagination: true,
          page_url_mode: "insert",
          page_insert_part: sep,
          page_total: total,
          method: `查询参数 ${param}=N`,
        };
      }
    }
  }

  // 2. Path-based pagination patterns: collect same-prefix URLs with a
  //    trailing/embedded number that differs from the current page.
  //    We normalise the current URL to a "stem" then check each href.

  // Strip trailing slash and any existing page number from path
  const basePath = base.pathname;

  // Pattern families: regex to match a page-number in path, plus how to
  // derive the insert_part for page 2.
  const pathPatterns: Array<{
    re: RegExp;
    insertFor2: (m: RegExpMatchArray) => string;
    mode: "suffix" | "insert";
    label: string;
  }> = [
    // /lastupdate_1/  or  /list_1/   (suffix before slash, optional ext)
    {
      re: /^(.*?)_(\d+)(\/?)$/,
      insertFor2: () => "_2",
      mode: "suffix",
      label: "路径后缀 _N",
    },
    // /list_1.html  →  _N.html
    {
      re: /^(.*?)_(\d+)(\.[\w]+)$/,
      insertFor2: (m) => `_2${m[3]}`,
      mode: "suffix",
      label: "路径后缀 _N.html",
    },
    // /page/2/  or  /page/2.html
    {
      re: /^(.*\/page\/)(\d+)(\/|\.[\w]+)?$/i,
      insertFor2: (m) => `${m[1]}2${m[3] ?? "/"}`,
      mode: "insert",
      label: "路径段 /page/N",
    },
    // /1.html  or  /1/  (pure number path segment at end)
    {
      re: /^(.*\/)(\d+)(\.[\w]+|\/)$/,
      insertFor2: (m) => `2${m[3]}`,
      mode: "suffix",
      label: "纯数字路径 N",
    },
  ];

  for (const pat of pathPatterns) {
    // Try to match the current URL path itself (page 1 might already have a number)
    const selfMatch = basePath.match(pat.re);
    const stem = selfMatch ? basePath.replace(pat.re, "$1") : basePath.replace(/\/$/, "");

    const nums: number[] = [];
    for (const h of hrefs) {
      try {
        const u = new URL(h);
        if (u.origin !== base.origin) continue;
        const m = u.pathname.match(pat.re);
        if (!m) continue;
        // Check same stem
        const hStem = u.pathname.replace(pat.re, "$1");
        if (hStem !== stem) continue;
        nums.push(Number(m[2]));
      } catch { /* skip */ }
    }

    if (nums.length >= 1) {
      const total = maxPage(nums);
      if (total >= 2) {
        // Build insert_part for page 2 using a dummy match or selfMatch
        const dummyMatch = `${stem}_2`.match(pat.re) ?? selfMatch;
        const insert2 = dummyMatch ? pat.insertFor2(dummyMatch) : "_2";
        return {
          has_pagination: true,
          page_url_mode: pat.mode,
          page_insert_part: insert2,
          page_total: total,
          method: pat.label,
        };
      }
    }
  }

  // 3. No number in current URL, but sibling URLs share same prefix and differ
  //    by a trailing number — e.g. current is /top/lastupdate/ and links include
  //    /top/lastupdate_2/, /top/lastupdate_3/.
  //    Generic check: look for hrefs that start with the current pathname and
  //    end with an extra _N or /N segment.
  {
    const stemNoSlash = basePath.replace(/\/$/, "");
    const re = new RegExp(`^${escapeRegex(stemNoSlash)}[_/](\\d+)/?$`);
    const nums: number[] = [];
    for (const h of hrefs) {
      try {
        const u = new URL(h);
        if (u.origin !== base.origin) continue;
        const m = u.pathname.replace(/\/$/, "").match(re) ??
                  u.pathname.match(re);
        if (m) nums.push(Number(m[1]));
      } catch { /* skip */ }
    }
    if (nums.length >= 1) {
      const total = maxPage(nums);
      if (total >= 2) {
        // Determine separator: _ or /
        const sep = hrefs.find((h) => {
          try { return new URL(h).pathname.replace(/\/$/, "").match(re); } catch { return false; }
        });
        const sepChar = sep ? (new URL(sep).pathname.includes("_") ? "_" : "/") : "_";
        return {
          has_pagination: true,
          page_url_mode: "suffix",
          page_insert_part: `${sepChar}2`,
          page_total: total,
          method: `相邻链接推断（${sepChar}N）`,
        };
      }
    }
  }

  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── XPath eval helper ────────────────────────────────────────────────────────

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
  } catch { return []; }
}

function resolveUrl(href: string, base: string): string {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  try { return new URL(href, base).href; } catch { return href; }
}

/** Merge names + urls (+ optional dates) into book items */
function mergeBooks(
  names: string[],
  urls: string[],
  dates: string[],
  base: string,
): UpdateListBookItem[] {
  const len = Math.min(names.length, urls.length);
  const books: UpdateListBookItem[] = [];
  for (let i = 0; i < len; i++) {
    const name = names[i]?.trim();
    const url  = resolveUrl(urls[i]?.trim() ?? "", base);
    if (name && url) books.push({ name, url, date: dates[i]?.trim() });
  }
  return books;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function WizardStep1UpdateList({ data, onChange }: Props) {
  const navigate = useNavigate();
  const aiEnabled = useAiStore((s) => s.config.enabled);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [fetchError, setFetchError]   = useState("");
  const [aiLoading, setAiLoading]     = useState<string | null>(null);
  const [aiError, setAiError]         = useState("");
  const [showSource, setShowSource]   = useState(false);
  const [autoMatchLoading, setAutoMatchLoading] = useState(false);
  const [paginationDetected, setPaginationDetected] = useState<PaginationDetectResult | null>(null);

  // ── Fetch HTML ──────────────────────────────────────────────────────────────

  const handleFetch = async () => {
    const url = data.update_list_url.trim();
    if (!url || url === "https://") return;
    setFetchStatus("loading");
    setFetchError("");
    setPaginationDetected(null);
    try {
      const html = await apiFetchSource(url);
      const detectedEncoding = detectCharset(html);
      // Re-parse books if rules already set
      const books = reparseBooks({ ...data, update_list_html: html });

      // Auto-detect pagination — apply only if not already configured
      let paginationPatch: Partial<WizardData> = {};
      const detected = detectPagination(html, url);
      if (detected && !data.has_pagination) {
        paginationPatch = {
          has_pagination:   true,
          page_url_mode:    detected.page_url_mode,
          page_insert_part: detected.page_insert_part,
          page_total:       detected.page_total,
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

  const ensureHtml = async (): Promise<string> => {
    if (data.update_list_html) return data.update_list_html;
    const url = data.update_list_url.trim();
    if (!url || url === "https://") throw new Error("请先填写最近更新列表页网址");
    const html = await apiFetchSource(url);
    onChange({ ...data, update_list_html: html });
    return html;
  };

  // ── Rule patch helper — also re-parses books ───────────────────────────────

  const patchRule = useCallback((
    key: "list_novel_name" | "list_release_date" | "list_release_url",
    rule: FieldRule,
  ) => {
    const next = { ...data, [key]: rule };
    const books = reparseBooks(next);
    onChange({ ...next, update_books: books });
  }, [data, onChange]);

  // ── Auto-match chapter links ────────────────────────────────────────────────

  const runAutoMatch = async () => {
    setAutoMatchLoading(true);
    setAiError("");
    try {
      const html = await ensureHtml();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
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
          if (snap.snapshotLength > bestCount) { bestCount = snap.snapshotLength; bestXpath = xpath; }
        } catch { /* skip */ }
      }
      const rule: FieldRule = { ...data.list_release_url, mode: "xpath", xpath: bestXpath || data.list_release_url.xpath };
      const next = { ...data, update_list_html: html, list_release_url: rule };
      onChange({ ...next, update_books: reparseBooks(next) });
    } catch (e) { setAiError(String(e)); }
    finally { setAutoMatchLoading(false); }
  };

  // ── AI batch ────────────────────────────────────────────────────────────────

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
        AI_SYSTEM, aiConfig,
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

  // ── AI pagination analysis ──────────────────────────────────────────────────

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

  // ── Book name test ───────────────────────────────────────────────────────────

  const [bookNameTest, setBookNameTest] = useState<{ count: number; sample: string } | null>(null);
  const testBookName = () => {
    if (!data.update_list_html) { setAiError("请先获取页面"); return; }
    const xpath = buildBookNameXPath(data);
    if (!xpath) { setBookNameTest(null); return; }
    const v = validateXPath(data.update_list_html, xpath);
    setBookNameTest({ count: v.count, sample: v.samples[0] ?? "" });
  };

  const bookNamePreview = useMemo(() => buildBookNameXPath(data), [data]);

  // ── Derived stats ────────────────────────────────────────────────────────────

  const htmlSize = data.update_list_html
    ? `${(data.update_list_html.length / 1024).toFixed(1)} KB`
    : null;

  const bookCount = data.update_books.length;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Instruction ─────────────────────────────────────────────────── */}
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3"
        style={{ background: "var(--color-accent-muted)", borderLeft: "2px solid var(--color-accent)" }}
      >
        <Globe className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--color-accent)" }} />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>
            第一步：最近更新列表页
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            输入站点的「最近更新」或「书籍列表」页地址，拉取后配置书名、链接、更新日期三条规则。列表解析正确后，下一步从中选一本书进入目录配置。
          </p>
        </div>
      </div>

      {/* ── URL + fetch ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            label="最近更新列表页地址"
            placeholder="https://example.com/update/ 或 /list/latest/"
            value={data.update_list_url}
            onChange={(e) => {
              onChange({ ...data, update_list_url: e.target.value, update_list_html: "" });
              setFetchStatus("idle");
              setPaginationDetected(null);
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleFetch(); }}
          />
        </div>
        <Button
          size="sm"
          variant={fetchStatus === "ok" ? "secondary" : "primary"}
          onClick={handleFetch}
          disabled={fetchStatus === "loading" || !data.update_list_url.trim() || data.update_list_url === "https://"}
        >
          {fetchStatus === "loading"
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Search className="w-3.5 h-3.5" />
          }
          {fetchStatus === "loading" ? "获取中..." : "获取页面"}
        </Button>
      </div>

      {/* Fetch status */}
      {fetchStatus === "ok" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">页面获取成功（{htmlSize}），已缓存，可配置下方规则</span>
          </div>
          {paginationDetected && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)", border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)" }}>
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span className="flex-1">
                已自动检测到分页（{paginationDetected.method}）：共 {paginationDetected.page_total} 页，插入片段「{paginationDetected.page_insert_part}」
              </span>
              <button
                className="shrink-0 text-xs underline opacity-70 hover:opacity-100"
                onClick={() => {
                  onChange({ ...data, has_pagination: false });
                  setPaginationDetected(null);
                }}
              >
                撤销
              </button>
            </div>
          )}
        </div>
      )}
      {fetchStatus === "error" && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{fetchError || "页面请求失败，请检查网址"}</span>
        </div>
      )}

      {/* ── Quick tools row ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Auto match */}
        <Button size="sm" variant="secondary" onClick={runAutoMatch} disabled={autoMatchLoading}>
          {autoMatchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          自动匹配链接
        </Button>

        {/* Common URL rules dropdown */}
        <select
          className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none"
          style={{
            background: "var(--color-surface-1)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
            flex: "1 1 140px", minWidth: 0,
          }}
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const rule: FieldRule = { ...data.list_release_url, mode: "xpath", xpath: v };
            const next = { ...data, list_release_url: rule };
            onChange({ ...next, update_books: reparseBooks(next) });
          }}
        >
          {COMMON_URL_RULES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        {/* View source */}
        <button
          onClick={async () => {
            if (!data.update_list_html) { try { await ensureHtml(); } catch { /* ignore */ } }
            setShowSource((v) => !v);
          }}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors shrink-0"
          style={{
            background: showSource ? "var(--color-accent-muted)" : "var(--color-surface-1)",
            borderColor: showSource
              ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
              : "var(--color-border)",
            color: showSource ? "var(--color-accent)" : "var(--color-text-muted)",
          }}
        >
          <Code2 className="w-3 h-3" />
          源码
        </button>

        {/* AI batch */}
        {aiEnabled ? (
          <Button size="sm" onClick={runBatchAi} disabled={aiLoading !== null}>
            {aiLoading === "batch" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {aiLoading === "batch" ? "AI 分析中..." : "AI 批量分析"}
          </Button>
        ) : (
          <button
            onClick={() => navigate("/settings?tab=ai")}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors shrink-0"
            style={{
              background: "var(--color-surface-1)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-subtle)",
            }}
          >
            <Sparkles className="w-3 h-3" style={{ color: "var(--color-text-subtle)" }} />
            AI 未启用（点此开启）
          </button>
        )}
      </div>

      {/* Source preview */}
      {showSource && data.update_list_html && (
        <div
          className="rounded-lg border overflow-auto font-mono text-xs leading-relaxed p-2"
          style={{
            background: "var(--color-surface-2)", borderColor: "var(--color-border)",
            maxHeight: 160, color: "var(--color-text-muted)",
            whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}
        >
          {data.update_list_html.slice(0, 8000)}
          {data.update_list_html.length > 8000 && "\n\n… 已截断（仅显示前 8000 字符）"}
        </div>
      )}

      {/* AI / general error */}
      {aiError && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{aiError}</span>
        </div>
      )}

      {/* ── Rule editors ────────────────────────────────────────────────── */}
      <Section title="列表页规则（必填）" color="var(--color-danger)">
        <FieldRuleEditor
          label="书名 *"
          rule={data.list_novel_name}
          onChange={(r) => patchRule("list_novel_name", r)}
          aiEnabled={aiEnabled}
          onAiRequest={() => runFieldAi("list_novel_name", "书名")}
          aiLoading={aiLoading === "list_novel_name"}
          html={data.update_list_html || undefined}
        />
        <FieldRuleEditor
          label="书籍链接 *"
          rule={data.list_release_url}
          onChange={(r) => patchRule("list_release_url", r)}
          aiEnabled={aiEnabled}
          onAiRequest={() => runFieldAi("list_release_url", "书籍链接")}
          aiLoading={aiLoading === "list_release_url"}
          html={data.update_list_html || undefined}
        />
        <FieldRuleEditor
          label="更新日期"
          rule={data.list_release_date}
          onChange={(r) => patchRule("list_release_date", r)}
          aiEnabled={aiEnabled}
          onAiRequest={() => runFieldAi("list_release_date", "更新日期")}
          aiLoading={aiLoading === "list_release_date"}
          html={data.update_list_html || undefined}
        />
      </Section>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      <Section
        title="分页设置"
        color="var(--color-text-muted)"
        badge={data.has_pagination && paginationDetected ? "已自动检测" : undefined}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={data.has_pagination}
              onChange={(e) => onChange({ ...data, has_pagination: e.target.checked })}
              className="w-3.5 h-3.5 rounded"
            />
            <span className="text-xs" style={{ color: "var(--color-text)" }}>存在分页</span>
          </label>
          {/* AI pagination analysis */}
          {aiEnabled ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={runPaginationAi}
              disabled={aiLoading !== null}
            >
              {aiLoading === "pagination"
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Sparkles className="w-3 h-3" />
              }
              {aiLoading === "pagination" ? "AI 分析中..." : "AI 分析分页"}
            </Button>
          ) : null}
        </div>

        {data.has_pagination && (
          <div className="flex flex-wrap gap-3 mt-2 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>链接变化方式</label>
              <select
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none"
                style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                value={data.page_url_mode}
                onChange={(e) => onChange({ ...data, page_url_mode: e.target.value as "suffix" | "insert" })}
              >
                {PAGE_URL_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1" style={{ width: 80 }}>
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>分页总数</label>
              <input
                type="number" min={1} max={999}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none w-full"
                style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                value={data.page_total}
                onChange={(e) => onChange({ ...data, page_total: Math.max(1, Number(e.target.value)) })}
              />
            </div>
            <div className="flex flex-col gap-1 flex-1" style={{ minWidth: 100 }}>
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>插入链接部分</label>
              <Input
                placeholder="如：_2  ?page=2"
                value={data.page_insert_part}
                onChange={(e) => onChange({ ...data, page_insert_part: e.target.value })}
              />
            </div>
          </div>
        )}
        <p className="text-xs mt-1" style={{ color: "var(--color-text-subtle)" }}>
          {data.has_pagination
            ? `共 ${data.page_total} 页，每页在链接中插入「${data.page_insert_part}」`
            : "若列表为单页，无需勾选"}
        </p>
      </Section>

      {/* ── Book name (optional) ────────────────────────────────────────── */}
      <Section title="书籍名称 XPath（可选）" color="var(--color-text-muted)">
        <BookNameConfig data={data} onChange={onChange} bookNamePreview={bookNamePreview} bookNameTest={bookNameTest} testBookName={testBookName} />
      </Section>

      {/* ── Live book list preview ──────────────────────────────────────── */}
      {bookCount > 0 && (
        <BookListPreview books={data.update_books} />
      )}

      {/* ── No result hint ──────────────────────────────────────────────── */}
      {data.update_list_html && bookCount === 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}>
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            规则尚未命中书籍列表，请在底部点「XPath 工具」或手动填写规则，命中后书籍会自动出现在这里
          </span>
        </div>
      )}

    </div>
  );
}

// ─── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, color = "var(--color-text-muted)", badge, children }: {
  title: string; color?: string; badge?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl p-3 border"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold" style={{ color }}>{title}</p>
        {badge && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)", fontSize: 10 }}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── BookNameConfig ────────────────────────────────────────────────────────────

function BookNameConfig({ data, onChange, bookNamePreview, bookNameTest, testBookName }: {
  data: WizardData;
  onChange: (d: WizardData) => void;
  bookNamePreview: string;
  bookNameTest: { count: number; sample: string } | null;
  testBookName: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={data.book_name_use_xpath}
          onChange={(e) => onChange({ ...data, book_name_use_xpath: e.target.checked })}
          className="w-3.5 h-3.5 rounded"
        />
        <span className="text-xs" style={{ color: "var(--color-text)" }}>使用 XPath 提取书名</span>
        {bookNamePreview && (
          <code className="text-xs font-mono ml-2 px-2 py-0.5 rounded"
            style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}>
            {bookNamePreview}
          </code>
        )}
      </label>
      <div className="flex gap-2 flex-wrap items-end">
        {["h1","h2","h3","h4","div","span","p","title"].map((t) => (
          <button
            key={t}
            onClick={() => onChange({ ...data, book_name_tag: t })}
            className="text-xs px-2 py-1 rounded border transition-colors"
            style={{
              background: data.book_name_tag === t ? "var(--color-accent-muted)" : "var(--color-surface-1)",
              borderColor: data.book_name_tag === t
                ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
                : "var(--color-border)",
              color: data.book_name_tag === t ? "var(--color-accent)" : "var(--color-text-muted)",
            }}
          >
            {t}
          </button>
        ))}
        <div className="flex-1" style={{ minWidth: 80 }}>
          <Input
            placeholder="属性值，如 bookname"
            value={data.book_name_val}
            onChange={(e) => onChange({ ...data, book_name_val: e.target.value })}
          />
        </div>
        <button
          onClick={testBookName}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors shrink-0"
          style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)", color: "var(--color-accent)" }}
        >
          测试
        </button>
      </div>
      {bookNameTest !== null && (
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
          style={{
            background: bookNameTest.count > 0 ? "var(--color-success-bg)" : "var(--color-warning-bg)",
            color: bookNameTest.count > 0 ? "var(--color-success)" : "var(--color-warning)",
          }}>
          命中 {bookNameTest.count} 个
          {bookNameTest.sample && <span style={{ color: "var(--color-text-muted)" }}>— {bookNameTest.sample}</span>}
        </div>
      )}
    </div>
  );
}

// ─── BookListPreview ──────────────────────────────────────────────────────────

function BookListPreview({ books }: { books: UpdateListBookItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? books : books.slice(0, 5);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold flex-1" style={{ color: "var(--color-text)" }}>
          实时解析预览
        </p>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
        >
          <CheckCircle2 className="w-2.5 h-2.5 inline mr-1" />
          {books.length} 本书
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {visible.map((b, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border"
            style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
              style={{ background: "var(--color-surface-2)", color: "var(--color-text-subtle)" }}
            >
              {i + 1}
            </span>
            <span className="font-medium flex-1 truncate" style={{ color: "var(--color-text)" }}>
              {b.name}
            </span>
            {b.date && (
              <span className="shrink-0 text-xs" style={{ color: "var(--color-text-subtle)" }}>
                {b.date}
              </span>
            )}
            <span
              className="truncate font-mono text-right shrink-0 max-w-[30%]"
              style={{ color: "var(--color-text-subtle)", fontSize: 10 }}
              title={b.url}
            >
              {b.url.replace(/^https?:\/\/[^/]+/, "")}
            </span>
          </div>
        ))}
      </div>
      {books.length > 5 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 self-start text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          {expanded
            ? <><ChevronUp className="w-3 h-3" />收起</>
            : <><ChevronDown className="w-3 h-3" />展开全部 {books.length} 本</>
          }
        </button>
      )}
      <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
        ✓ 列表解析正确后，点「下一步」从中选择一本书进入目录配置
      </p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function buildBookNameXPath(data: WizardData): string {
  if (!data.book_name_use_xpath) return "";
  const tag = data.book_name_tag || "*";
  const val = data.book_name_val.trim();
  if (val) return `//${tag}[@class="${val}"]/text()`;
  return `//${tag}/text()`;
}

function applyAiResult(existing: FieldRule, result?: { xpath?: string }): FieldRule {
  const xpath = result?.xpath ?? "";
  if (!xpath) return existing;
  return { ...existing, mode: "ai", xpath };
}

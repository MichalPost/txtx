// ─── Rule mode types ───────────────────────────────────────────────────────────

export type RuleMode =
  | "tag_name" // 按标签名称        → //tag/text()
  | "attr_name" // 按属性名称        → //*[@attr]/text()
  | "attr_value" // 按属性及值        → //*[@attr="val"]/text()
  | "tag_attr_value" // 标签名+属性+值    → //tag[@attr="val"]/text()
  | "link_keyword" // 按链接关键字      → //a[contains(@href,"kw")]/@href
  | "text_keyword" // 按文本关键字      → //*[contains(text(),"kw")]/text()
  | "xpath" // XPath 路径        → 直接填写
  | "ai"; // AI 辅助           → 运行后写入 xpath

export type ExtractAs = "text" | "href" | "src" | "custom";

export interface FieldRule {
  mode: RuleMode;
  // tag 模式
  tag_name: string;
  // attr 模式
  attr_name: string;
  attr_val: string;
  // keyword 模式
  keyword: string;
  // extract target
  extract: ExtractAs;
  custom_attr: string; // when extract === "custom"
  // final xpath (direct input or converted / AI-generated)
  xpath: string;
}

export const RULE_MODES: { value: RuleMode; label: string }[] = [
  { value: "tag_name", label: "按标签名称" },
  { value: "attr_name", label: "按属性名称" },
  { value: "attr_value", label: "按属性及值" },
  { value: "tag_attr_value", label: "标签名+属性+值" },
  { value: "link_keyword", label: "按链接关键字" },
  { value: "text_keyword", label: "按文本关键字" },
  { value: "xpath", label: "XPath 路径" },
  { value: "ai", label: "AI 辅助生成" },
];

export function emptyFieldRule(mode: RuleMode = "xpath"): FieldRule {
  return {
    mode,
    tag_name: "",
    attr_name: "",
    attr_val: "",
    keyword: "",
    extract: "text",
    custom_attr: "",
    xpath: "",
  };
}

// ─── XPath builder ─────────────────────────────────────────────────────────────

/** Convert a FieldRule to the final XPath expression string */
export function buildXPathFromRule(rule: FieldRule): string {
  const suffix = extractSuffix(rule);

  switch (rule.mode) {
    case "tag_name": {
      const tag = rule.tag_name.trim() || "*";
      return `//${tag}${suffix}`;
    }
    case "attr_name": {
      const attr = rule.attr_name.trim();
      if (!attr) return "";
      return `//*[@${attr}]${suffix}`;
    }
    case "attr_value": {
      const attr = rule.attr_name.trim();
      const val = rule.attr_val.trim();
      if (!attr) return "";
      if (!val) return `//*[@${attr}]${suffix}`;
      return `//*[@${attr}="${val}"]${suffix}`;
    }
    case "tag_attr_value": {
      const tag = rule.tag_name.trim() || "*";
      const attr = rule.attr_name.trim();
      const val = rule.attr_val.trim();
      if (!attr) return `//${tag}${suffix}`;
      if (!val) return `//${tag}[@${attr}]${suffix}`;
      return `//${tag}[@${attr}="${val}"]${suffix}`;
    }
    case "link_keyword": {
      const kw = rule.keyword.trim();
      if (!kw) return "//a/@href";
      return `//a[contains(@href,"${kw}")]/@href`;
    }
    case "text_keyword": {
      const kw = rule.keyword.trim();
      if (!kw) return `//*${suffix}`;
      return `//*[contains(text(),"${kw}")]${suffix}`;
    }
    case "xpath":
    case "ai":
      return rule.xpath;
    default:
      return "";
  }
}

function extractSuffix(rule: FieldRule): string {
  switch (rule.extract) {
    case "href":
      return "/@href";
    case "src":
      return "/@src";
    case "custom":
      return rule.custom_attr ? `/@${rule.custom_attr}` : "/text()";
    default:
      return "/text()";
  }
}

// ─── Which inputs are visible per mode ────────────────────────────────────────

export interface VisibleInputs {
  tag_name: boolean;
  attr_name: boolean;
  attr_val: boolean;
  keyword: boolean;
  extract: boolean;
  xpath_direct: boolean;
}

export function getVisibleInputs(mode: RuleMode): VisibleInputs {
  return {
    tag_name: ["tag_name", "tag_attr_value"].includes(mode),
    attr_name: ["attr_name", "attr_value", "tag_attr_value"].includes(mode),
    attr_val: ["attr_value", "tag_attr_value"].includes(mode),
    keyword: ["link_keyword", "text_keyword"].includes(mode),
    extract: ["tag_name", "attr_name", "attr_value", "tag_attr_value", "text_keyword"].includes(
      mode,
    ),
    xpath_direct: mode === "xpath",
  };
}

// ─── Wizard data ───────────────────────────────────────────────────────────────

/** A single book entry parsed from the recent-update list page */
export interface UpdateListBookItem {
  name: string;
  url: string; // book catalog/detail page URL
  date?: string; // update date if available
}

export interface ChapterListItem {
  title: string;
  url: string;
  date?: string;
}

export interface WizardData {
  // ── Step 1: 最近更新列表页 ────────────────────────────────────────────────
  update_list_url: string; // the recent-update list page URL
  update_list_html: string; // fetched HTML cache

  // Step 1 — list page rules (书名 / 书籍链接 / 更新日期)
  list_novel_name: FieldRule;
  list_release_date: FieldRule;
  list_release_url: FieldRule;

  // Step 1 — pagination
  has_pagination: boolean;
  page_url_mode: "suffix" | "insert";
  page_total: number;
  page_insert_part: string;

  // Step 1 — parsed book list (derived from rules + HTML)
  update_books: UpdateListBookItem[];

  // ── Step 2: 选书 → 填入目录 URL ──────────────────────────────────────────
  selected_book_name: string;
  selected_book_url: string; // auto-fills catalog_url
  catalog_url: string; // the catalog / chapter-list page URL

  // ── Step 3: 目录规则 ──────────────────────────────────────────────────────
  // (chapter list rules — reuses catalog_html)

  // Step 3 — book name helper (optional)
  book_name_use_xpath: boolean;
  book_name_tag: string;
  book_name_attr: string;
  book_name_val: string;

  // ── Step 5: 章节页规则 ────────────────────────────────────────────────────
  chap_novel_name: FieldRule;
  chap_chapter_url: FieldRule;
  chap_content: FieldRule;
  chap_content_fallbacks: string[];
  /** XPath for "next page" link inside a chapter page. Empty = single-page. */
  chapter_next_page_xpath: string;

  // ── 编码 ──────────────────────────────────────────────────────────────────
  /** Per-site response encoding, e.g. "gbk". Empty = auto. */
  encoding: string;

  // ── Caches ────────────────────────────────────────────────────────────────
  catalog_html: string; // fetched catalog page HTML
  chapter_html: string; // fetched sample chapter HTML
  chapter_test_url: string; // chapter URL extracted in step 4 for testing
  chapter_items: ChapterListItem[];
  selected_chapter_title: string;
}

function inferExtractFromXPath(xpath: string): ExtractAs {
  const trimmed = xpath.trim().toLowerCase();
  if (!trimmed) return "text";
  if (trimmed.endsWith("/@href")) return "href";
  if (trimmed.endsWith("/@src")) return "src";
  const attrMatch = trimmed.match(/\/@([a-z0-9:_-]+)$/i);
  if (attrMatch) {
    return attrMatch[1] === "href" ? "href" : attrMatch[1] === "src" ? "src" : "custom";
  }
  return "text";
}

function inferCustomAttr(xpath: string): string {
  const match = xpath.trim().match(/\/@([a-zA-Z0-9:_-]+)$/);
  if (!match) return "";
  const attr = match[1].toLowerCase();
  return attr === "href" || attr === "src" ? "" : match[1];
}

export function fieldRuleFromXPath(xpath: string, fallbackMode: RuleMode = "xpath"): FieldRule {
  const trimmed = xpath.trim();
  if (!trimmed) return emptyFieldRule(fallbackMode);
  return {
    ...emptyFieldRule("xpath"),
    mode: "xpath",
    xpath: trimmed,
    extract: inferExtractFromXPath(trimmed),
    custom_attr: inferCustomAttr(trimmed),
  };
}

export function emptyWizardData(domain_name = "", encoding = ""): WizardData {
  return {
    update_list_url: domain_name,
    update_list_html: "",

    list_novel_name: emptyFieldRule("xpath"),
    list_release_date: emptyFieldRule("xpath"),
    list_release_url: emptyFieldRule("link_keyword"),

    has_pagination: false,
    page_url_mode: "suffix",
    page_total: 1,
    page_insert_part: "_2",

    update_books: [],

    selected_book_name: "",
    selected_book_url: "",
    catalog_url: domain_name,

    book_name_use_xpath: false,
    book_name_tag: "h2",
    book_name_attr: "",
    book_name_val: "",

    chap_novel_name: emptyFieldRule("tag_attr_value"),
    chap_chapter_url: emptyFieldRule("link_keyword"),
    chap_content: emptyFieldRule("xpath"),
    chap_content_fallbacks: [],
    chapter_next_page_xpath: "",

    encoding,

    catalog_html: "",
    chapter_html: "",
    chapter_test_url: "",
    chapter_items: [],
    selected_chapter_title: "",
  };
}

export function wizardDataFromSite(site: {
  domain_name: string;
  encoding?: string;
  list_novel_name: string;
  release_date: string;
  release_url: string;
  novel_name_x: string;
  chapter_url_x: string;
  novel_content: string;
  novel_content_fallbacks?: string[];
  chapter_next_page_xpath?: string;
}): WizardData {
  const baseUrl = site.domain_name || "https://";
  return {
    ...emptyWizardData(baseUrl, site.encoding ?? ""),
    update_list_url: baseUrl,
    catalog_url: baseUrl,
    list_novel_name: fieldRuleFromXPath(site.list_novel_name),
    list_release_date: fieldRuleFromXPath(site.release_date),
    list_release_url: fieldRuleFromXPath(site.release_url || "", "link_keyword"),
    chap_novel_name: fieldRuleFromXPath(site.novel_name_x, "tag_attr_value"),
    chap_chapter_url: fieldRuleFromXPath(site.chapter_url_x || "", "link_keyword"),
    chap_content: fieldRuleFromXPath(site.novel_content),
    chap_content_fallbacks: [...(site.novel_content_fallbacks ?? [])],
    chapter_next_page_xpath: site.chapter_next_page_xpath ?? "",
  };
}

// ─── Charset detection ────────────────────────────────────────────────────────

/**
 * Detect the declared charset from HTML source.
 *
 * Priority order (mirrors browser behavior):
 * 1. <meta charset="...">
 * 2. <meta http-equiv="Content-Type" content="text/html; charset=...">
 * 3. <?xml version="1.0" encoding="..."?>
 *
 * Returns a normalised lowercase name (e.g. "gbk", "utf-8", "big5"),
 * or empty string when nothing is found or the result is a UTF-8 variant
 * (no override needed for those).
 */
export function detectCharset(html: string): string {
  if (!html) return "";

  // Only scan the first 4 KB — charset declarations always appear in <head>
  const head = html.slice(0, 4096);

  // 1. <meta charset="gbk" />
  const m1 = head.match(/<meta[^>]+charset\s*=\s*["']?\s*([a-zA-Z0-9\-_]+)\s*["']?/i);
  // 2. content="text/html; charset=gbk"
  const m2 = head.match(/charset\s*=\s*["']?\s*([a-zA-Z0-9\-_]+)/i);
  // 3. <?xml ... encoding="gbk"?>
  const m3 = head.match(/encoding\s*=\s*["']\s*([a-zA-Z0-9\-_]+)\s*["']/i);

  const raw = (m1?.[1] ?? m2?.[1] ?? m3?.[1] ?? "").toLowerCase().trim();
  if (!raw) return "";

  // Normalise common aliases
  const normalised = raw
    .replace(/^utf[-_]?8$/i, "utf-8")
    .replace(/^gbk$/i, "gbk")
    .replace(/^gb[-_]?2312$/i, "gbk") // gb2312 is a subset of gbk; treat same
    .replace(/^big[-_]?5$/i, "big5")
    .replace(/^windows[-_]?1252$/i, "windows-1252");

  // No override needed for UTF-8 variants
  if (normalised === "utf-8" || normalised === "utf8") return "";

  return normalised;
}

/**
 * xpathTool.ts — 关键字定位 XPath 生成算法
 *
 * 流程：
 * 1. 用户指定定位关键字 + 关键字类型（文本/链接/class属性）
 * 2. 在 HTML 中找到包含该关键字的锚元素
 * 3. 从锚元素推断目标字段的 XPath（向上寻找合适容器，向目标字段取路径）
 * 4. 返回：定位表达式（可调整）+ 各目标字段的生成 XPath
 */

// ─── Public types ──────────────────────────────────────────────────────────────

export type KeywordType = "text" | "href" | "class";

export type TargetField =
  // 目录页
  | "chapter_name"
  | "chapter_url"
  | "book_name"
  // 章节页
  | "novel_content";

export interface XPathTarget {
  field: TargetField;
  label: string;
  /** Which page this target belongs to */
  page: "catalog" | "chapter";
}

export const XPATH_TARGETS: XPathTarget[] = [
  { field: "chapter_name",   label: "章节名称", page: "catalog" },
  { field: "chapter_url",    label: "章节链接", page: "catalog" },
  { field: "book_name",      label: "书籍名称", page: "catalog" },
  { field: "novel_content",  label: "小说正文", page: "chapter" },
];

export const KEYWORD_TYPE_LABELS: Record<KeywordType, string> = {
  text:  "文本内容",
  href:  "跳转链接",
  class: "class 属性",
};

export interface XPathToolResult {
  /** The anchor XPath expression (locates the keyword element) */
  anchor_xpath: string;
  /** Generated XPath per target field */
  generated: Partial<Record<TargetField, string>>;
  /** Number of anchor elements found */
  anchor_count: number;
  /** Text samples from anchor elements */
  anchor_samples: string[];
  /** Any error message */
  error?: string;
}

// ─── Core algorithm ────────────────────────────────────────────────────────────

/**
 * Main entry point:
 * Given HTML + keyword config, locate anchor element(s) and generate XPath
 * for the requested target fields.
 */
export function generateXPathFromKeyword(
  html: string,
  keyword: string,
  keywordType: KeywordType,
  targets: TargetField[],
  customAnchorXPath?: string, // user-adjusted anchor override
): XPathToolResult {
  if (!keyword.trim()) {
    return { anchor_xpath: "", generated: {}, anchor_count: 0, anchor_samples: [], error: "请输入定位关键字" };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Step 1: build or use anchor XPath
    const anchorXPath = customAnchorXPath?.trim() || buildAnchorXPath(keyword, keywordType);

    // Step 2: evaluate anchor
    let anchorSnapshot: XPathResult;
    try {
      anchorSnapshot = document.evaluate(
        anchorXPath, doc, null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null,
      );
    } catch {
      return {
        anchor_xpath: anchorXPath,
        generated: {},
        anchor_count: 0,
        anchor_samples: [],
        error: `定位表达式语法错误，请检查：${anchorXPath}`,
      };
    }

    if (anchorSnapshot.snapshotLength === 0) {
      return {
        anchor_xpath: anchorXPath,
        generated: {},
        anchor_count: 0,
        anchor_samples: [],
        error: "未找到包含该关键字的元素，请换个关键字或调整关键字类型",
      };
    }

    // Collect anchor elements and samples
    const anchorElements: Element[] = [];
    const anchorSamples: string[] = [];
    for (let i = 0; i < Math.min(anchorSnapshot.snapshotLength, 5); i++) {
      const node = anchorSnapshot.snapshotItem(i);
      if (!node) continue;
      // For attribute nodes, get the owner element
      const el = node.nodeType === Node.ATTRIBUTE_NODE
        ? (node as Attr).ownerElement
        : (node.nodeType === Node.TEXT_NODE ? node.parentElement : node as Element);
      if (el) anchorElements.push(el);
      const text = (node.textContent ?? (node as Attr).value ?? "").trim().slice(0, 80);
      if (text) anchorSamples.push(text);
    }

    // Step 3: generate XPath per target from the first anchor element
    const firstAnchor = anchorElements[0];
    const generated: Partial<Record<TargetField, string>> = {};

    for (const target of targets) {
      const xpath = deriveTargetXPath(doc, firstAnchor, anchorXPath, target, keywordType);
      if (xpath) generated[target] = xpath;
    }

    return {
      anchor_xpath: anchorXPath,
      generated,
      anchor_count: anchorSnapshot.snapshotLength,
      anchor_samples: anchorSamples,
    };
  } catch (e) {
    return {
      anchor_xpath: customAnchorXPath || "",
      generated: {},
      anchor_count: 0,
      anchor_samples: [],
      error: String(e),
    };
  }
}

// ─── Anchor XPath builder ──────────────────────────────────────────────────────

function buildAnchorXPath(keyword: string, type: KeywordType): string {
  const kw = keyword.trim();
  switch (type) {
    case "text":
      return `//*[contains(normalize-space(text()),"${kw}")]`;
    case "href":
      return `//a[contains(@href,"${kw}")]`;
    case "class":
      return `//*[contains(@class,"${kw}")]`;
  }
}

// ─── Target XPath derivation ───────────────────────────────────────────────────

/**
 * From an anchor element + its XPath, derive the XPath for the target field.
 *
 * Strategy:
 * - Find a "row container" — the smallest ancestor that contains both the anchor
 *   and sibling elements (likely a li/tr/div row)
 * - From that container, descend to the specific field
 */
function deriveTargetXPath(
  doc: Document,
  anchor: Element,
  anchorXPath: string,
  target: TargetField,
  keywordType: KeywordType,
): string {
  switch (target) {
    case "chapter_name":
      return deriveChapterName(doc, anchor, anchorXPath, keywordType);
    case "chapter_url":
      return deriveChapterUrl(doc, anchor, anchorXPath, keywordType);
    case "book_name":
      return deriveBookName(doc, anchor);
    case "novel_content":
      return deriveNovelContent(doc, anchor, anchorXPath);
  }
}

// ── chapter_name ───────────────────────────────────────────────────────────────

function deriveChapterName(
  doc: Document,
  anchor: Element,
  anchorXPath: string,
  keywordType: KeywordType,
): string {
  // If keyword is text, the anchor itself is likely the chapter name element
  if (keywordType === "text") {
    // Walk up to find the <a> or closest text-bearing element
    const aEl = anchor.closest("a") ?? anchor;
    return buildRelativeFromDoc(doc, aEl, "/text()");
  }

  // If keyword is href, the anchor is a link → get its text content
  if (keywordType === "href") {
    const aEl = anchor.tagName === "A" ? anchor : anchor.closest("a");
    if (aEl) return buildRelativeFromDoc(doc, aEl, "/text()");
  }

  // Fallback: find sibling <a> elements in the same row
  const row = findRowContainer(anchor);
  if (row) {
    const rowXPath = buildAbsoluteXPath(doc, row);
    return `${rowXPath}//a/text()`;
  }

  return `${anchorXPath}/text()`;
}

// ── chapter_url ────────────────────────────────────────────────────────────────

function deriveChapterUrl(
  doc: Document,
  anchor: Element,
  anchorXPath: string,
  keywordType: KeywordType,
): string {
  // If keyword is href → anchor is the <a> itself
  if (keywordType === "href") {
    const aEl = anchor.tagName === "A" ? anchor : anchor.closest("a");
    if (aEl) return buildRelativeFromDoc(doc, aEl, "/@href");
  }

  // If keyword is text → look for closest <a> ancestor or sibling
  const aEl = anchor.closest("a");
  if (aEl) return buildRelativeFromDoc(doc, aEl, "/@href");

  // Find <a> in the same row
  const row = findRowContainer(anchor);
  if (row) {
    const rowXPath = buildAbsoluteXPath(doc, row);
    return `${rowXPath}//a/@href`;
  }

  return `${anchorXPath}/following-sibling::a/@href`;
}

// ── book_name ──────────────────────────────────────────────────────────────────

function deriveBookName(_doc: Document, anchor: Element): string {
  // Book name is typically in h1/h2 near the top of the page
  // Try common patterns
  const candidates = [
    "//h1[@class and contains(@class,'bookname')]/text()",
    "//h1[@id and contains(@id,'bookname')]/text()",
    "//div[contains(@class,'bookname')]/h1/text()",
    "//div[contains(@class,'bookinfo')]//h1/text()",
    "//h1/text()",
  ];

  // Check which one has content in the same doc
  for (const xpath of candidates) {
    try {
      const result = document.evaluate(
        xpath, anchor.ownerDocument!, null,
        XPathResult.FIRST_ORDERED_NODE_TYPE, null,
      );
      if (result.singleNodeValue?.textContent?.trim()) return xpath;
    } catch { /* continue */ }
  }

  // Fallback: look near the anchor for a heading
  const heading = anchor.closest("div,section,article")
    ?.querySelector("h1,h2,h3");
  if (heading) {
    const doc = anchor.ownerDocument!;
    return buildAbsoluteXPath(doc, heading) + "/text()";
  }

  return "//h1/text()";
}

// ── novel_content ──────────────────────────────────────────────────────────────

function deriveNovelContent(
  doc: Document,
  anchor: Element,
  anchorXPath: string,
): string {
  // Walk up from anchor looking for a block container with lots of text
  let el: Element | null = anchor;
  for (let i = 0; i < 8 && el; i++) {
    const tag = el.tagName.toLowerCase();
    if (["div", "article", "section", "main"].includes(tag)) {
      const text = el.textContent ?? "";
      // Heuristic: content div has > 200 chars
      if (text.trim().length > 200) {
        const id = el.getAttribute("id");
        const cls = el.getAttribute("class")?.split(" ").filter(Boolean)[0];
        if (id)  return `//${tag}[@id="${id}"]/text()`;
        if (cls) return `//${tag}[contains(@class,"${cls}")]/text()`;
        return buildAbsoluteXPath(doc, el) + "/text()";
      }
    }
    el = el.parentElement;
  }

  // Try common content patterns
  const patterns = [
    "//div[@id='content']/text()",
    "//div[@id='booktxt']/text()",
    "//div[contains(@class,'content')]/text()",
    "//div[contains(@class,'txt')]/text()",
    "//article/text()",
  ];
  for (const p of patterns) {
    try {
      const r = document.evaluate(p, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (r.singleNodeValue?.textContent?.trim()) return p;
    } catch { /* continue */ }
  }

  return `${anchorXPath}/parent::*/text()`;
}

// ─── DOM helpers ───────────────────────────────────────────────────────────────

/** Find the smallest ancestor that looks like a row/item container */
function findRowContainer(el: Element): Element | null {
  const ROW_TAGS = new Set(["li", "tr", "dd", "dt"]);
  const ROW_CLASS_HINTS = ["item", "row", "entry", "list-item", "novel", "book"];

  let cur: Element | null = el.parentElement;
  for (let i = 0; i < 6 && cur; i++) {
    const tag = cur.tagName.toLowerCase();
    if (ROW_TAGS.has(tag)) return cur;
    const cls = cur.getAttribute("class") ?? "";
    if (ROW_CLASS_HINTS.some((h) => cls.includes(h))) return cur;
    cur = cur.parentElement;
  }
  return el.parentElement;
}

/** Build an absolute XPath for an element, preferring id/class shortcuts */
function buildAbsoluteXPath(doc: Document, el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;

  while (cur && cur !== doc.documentElement) {
    const tag = cur.tagName.toLowerCase();
    const id = cur.getAttribute("id");
    const cls = cur.getAttribute("class")?.split(" ").filter(Boolean)[0];

    if (id) {
      parts.unshift(`//${tag}[@id="${id}"]`);
      break;
    }
    if (cls && parts.length === 0) {
      // Only use class shortcut for the first (deepest) element
      parts.unshift(`//${tag}[contains(@class,"${cls}")]`);
      break;
    }

    // Use positional index among same-tag siblings
    let idx = 1;
    let sib = cur.previousElementSibling;
    while (sib) {
      if (sib.tagName === cur.tagName) idx++;
      sib = sib.previousElementSibling;
    }
    parts.unshift(`${tag}[${idx}]`);
    cur = cur.parentElement;
  }

  if (parts.length === 0) return `//${el.tagName.toLowerCase()}`;

  // If we broke out of the loop with a // prefix already, return as-is
  if (parts[0].startsWith("//")) return parts.join("/");
  return "/" + parts.join("/");
}

/** Build an XPath for an element relative to the document, with suffix */
function buildRelativeFromDoc(doc: Document, el: Element, suffix: string): string {
  return buildAbsoluteXPath(doc, el) + suffix;
}

// ─── Validate a generated XPath against HTML ──────────────────────────────────

export interface ValidationResult {
  count: number;
  samples: string[];
  error?: string;
}

export function validateGeneratedXPath(html: string, xpath: string): ValidationResult {
  if (!xpath) return { count: 0, samples: [] };
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const snap = document.evaluate(
      xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null,
    );
    const samples: string[] = [];
    for (let i = 0; i < Math.min(snap.snapshotLength, 5); i++) {
      const node = snap.snapshotItem(i);
      const text = (node?.textContent ?? (node as Attr | null)?.value ?? "").trim().slice(0, 80);
      if (text) samples.push(text);
    }
    return { count: snap.snapshotLength, samples };
  } catch (e) {
    return { count: 0, samples: [], error: String(e) };
  }
}

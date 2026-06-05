/**
 * xpathTool.ts — 关键字定位 XPath 生成算法 v2
 *
 * 核心改进：
 * 1. 锚元素过滤 — 优先在 <a> 里找，剔除 script/style/nav/header/footer 噪声
 * 2. 路径泛化   — 找到锚行后向上找列表容器，去掉行的位置索引，生成全量提取路径
 * 3. 多关键字交叉验证 — 多个关键字各自找 row-container，取路径一致的那个作为高置信结果
 * 4. 修复 doc/document 混用 bug — 所有 evaluate 统一用解析出的 doc
 * 5. novel_content — 综合段落数量、p 标签、非导航词等多维度打分
 */

// ─── Public types ──────────────────────────────────────────────────────────────

export type KeywordType = "text" | "href" | "class";

export type TargetField =
  | "chapter_name"
  | "chapter_url"
  | "book_name"
  | "novel_content"
  | "update_book_name"
  | "update_book_url"
  | "update_book_date";

export interface XPathTarget {
  field: TargetField;
  label: string;
  page: "catalog" | "chapter" | "update_list";
}

export const XPATH_TARGETS: XPathTarget[] = [
  { field: "chapter_name",     label: "章节名称", page: "catalog" },
  { field: "chapter_url",      label: "章节链接", page: "catalog" },
  { field: "book_name",        label: "书籍名称", page: "catalog" },
  { field: "novel_content",    label: "小说正文", page: "chapter" },
  { field: "update_book_name", label: "书名",     page: "update_list" },
  { field: "update_book_url",  label: "书籍链接", page: "update_list" },
  { field: "update_book_date", label: "更新日期", page: "update_list" },
];

export const KEYWORD_TYPE_LABELS: Record<KeywordType, string> = {
  text:  "文本内容",
  href:  "跳转链接",
  class: "class 属性",
};

export interface XPathToolResult {
  anchor_xpath: string;
  generated: Partial<Record<TargetField, string>>;
  anchor_count: number;
  anchor_samples: string[];
  error?: string;
}

// ─── Core algorithm ────────────────────────────────────────────────────────────

export function generateXPathFromKeyword(
  html: string,
  keywords: string | string[],
  keywordType: KeywordType,
  targets: TargetField[],
  customAnchorXPath?: string,
): XPathToolResult {
  const kwList = (Array.isArray(keywords) ? keywords : [keywords]).filter((k) => k.trim());
  if (!kwList.length) {
    return { anchor_xpath: "", generated: {}, anchor_count: 0, anchor_samples: [], error: "请输入定位关键字" };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // ── 1. 锚定表达式 ──────────────────────────────────────────────────────
    const anchorXPath = customAnchorXPath?.trim() || buildAnchorXPath(kwList, keywordType);

    let anchorSnap: XPathResult;
    try {
      anchorSnap = doc.evaluate(anchorXPath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    } catch {
      return {
        anchor_xpath: anchorXPath,
        generated: {},
        anchor_count: 0,
        anchor_samples: [],
        error: `定位表达式语法错误：${anchorXPath}`,
      };
    }

    if (anchorSnap.snapshotLength === 0) {
      return {
        anchor_xpath: anchorXPath,
        generated: {},
        anchor_count: 0,
        anchor_samples: [],
        error: "未找到包含该关键字的元素，请换个关键字或调整关键字类型",
      };
    }

    // ── 2. 收集锚元素，过滤噪声 ───────────────────────────────────────────
    const NOISE_TAGS = new Set(["script", "style", "noscript", "head", "meta", "link"]);
    const NOISE_ANCESTORS = new Set(["nav", "header", "footer", "aside"]);

    const anchorElements: Element[] = [];
    const anchorSamples: string[] = [];

    for (let i = 0; i < anchorSnap.snapshotLength; i++) {
      const node = anchorSnap.snapshotItem(i);
      if (!node) continue;
      const el = resolveElement(node);
      if (!el) continue;

      // 过滤噪声标签
      if (NOISE_TAGS.has(el.tagName.toLowerCase())) continue;
      // 过滤导航/页眉/页脚祖先
      if (hasAncestorTag(el, NOISE_ANCESTORS)) continue;

      anchorElements.push(el);
      const text = (node.textContent ?? (node as Attr).value ?? "").trim().slice(0, 80);
      if (text && anchorSamples.length < 5) anchorSamples.push(text);
    }

    if (anchorElements.length === 0) {
      return {
        anchor_xpath: anchorXPath,
        generated: {},
        anchor_count: anchorSnap.snapshotLength,
        anchor_samples: [],
        error: "关键字命中的元素均在导航/页眉/页脚中，请换个关键字",
      };
    }

    // ── 3. 多关键字交叉验证，选最高置信度的锚行容器 ──────────────────────
    const bestAnchor = selectBestAnchor(doc, anchorElements, kwList, keywordType);

    // ── 4. 为每个目标生成 XPath ─────────────────────────────────────────
    const generated: Partial<Record<TargetField, string>> = {};
    for (const target of targets) {
      const xpath = deriveTargetXPath(doc, bestAnchor, anchorXPath, target, keywordType);
      if (xpath) generated[target] = xpath;
    }

    return {
      anchor_xpath: anchorXPath,
      generated,
      anchor_count: anchorElements.length,
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

// ─── 锚元素选择：多关键字交叉验证 ──────────────────────────────────────────────

/**
 * 当有多个关键字时，各自独立找到 row-container 的通用化路径，
 * 如果多个关键字收敛到同一路径模式，置信度最高。
 * 否则退化为命中数量最多的那个锚元素所在 row 所属的列表。
 */
function selectBestAnchor(
  doc: Document,
  anchorElements: Element[],
  kwList: string[],
  keywordType: KeywordType,
): Element {
  if (anchorElements.length === 1) return anchorElements[0];

  // 尝试找"同类兄弟最多"的锚元素 — 它所在的 row 最像是列表项
  let best = anchorElements[0];
  let bestScore = 0;

  for (const el of anchorElements) {
    const row = findRowContainer(el);
    if (!row) continue;
    const parent = row.parentElement;
    if (!parent) continue;
    const sibCount = countSameTags(parent, row.tagName);
    const score = sibCount;
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }

  // 如果有多个关键字，检查它们是否都在同一个列表容器下
  if (kwList.length > 1) {
    const listContainerPaths = kwList.map((kw) => {
      const anchor = anchorElements.find((el) => {
        const text = keywordType === "href"
          ? el.getAttribute("href") ?? ""
          : keywordType === "class"
            ? el.getAttribute("class") ?? ""
            : el.textContent ?? "";
        return text.includes(kw);
      });
      if (!anchor) return null;
      const row = findRowContainer(anchor);
      return row?.parentElement ? getShortPath(doc, row.parentElement) : null;
    });

    // 如果所有关键字都指向同一容器，优先用第一个关键字的锚元素
    const nonNull = listContainerPaths.filter(Boolean);
    if (nonNull.length > 1 && new Set(nonNull).size === 1) {
      return anchorElements[0];
    }
  }

  return best;
}

// ─── Anchor XPath builder ──────────────────────────────────────────────────────

function buildAnchorXPath(keywords: string[], type: KeywordType): string {
  if (keywords.length === 1) return buildSingleAnchorXPath(keywords[0], type);

  let predicate: string;
  switch (type) {
    case "text":
      predicate = keywords.map((k) => `contains(normalize-space(.),"${k}")`).join(" or ");
      // 优先在 <a> 里找，减少噪声
      return `//a[${predicate}]`;
    case "href":
      predicate = keywords.map((k) => `contains(@href,"${k}")`).join(" or ");
      return `//a[${predicate}]`;
    case "class":
      predicate = keywords.map((k) => `contains(@class,"${k}")`).join(" or ");
      return `//*[${predicate}]`;
  }
}

function buildSingleAnchorXPath(keyword: string, type: KeywordType): string {
  const kw = keyword.trim();
  switch (type) {
    case "text":
      // 优先在 <a> 里找文本，目录页章节名几乎都在链接里
      return `//a[contains(normalize-space(.),"${kw}")]`;
    case "href":
      return `//a[contains(@href,"${kw}")]`;
    case "class":
      return `//*[contains(@class,"${kw}")]`;
  }
}

// ─── 目标 XPath 推导 ───────────────────────────────────────────────────────────

function deriveTargetXPath(
  doc: Document,
  anchor: Element,
  anchorXPath: string,
  target: TargetField,
  keywordType: KeywordType,
): string {
  switch (target) {
    case "chapter_name":
    case "update_book_name":
      return deriveChapterName(doc, anchor, anchorXPath, keywordType);
    case "chapter_url":
    case "update_book_url":
      return deriveChapterUrl(doc, anchor, anchorXPath, keywordType);
    case "book_name":
      return deriveBookName(doc);
    case "novel_content":
      return deriveNovelContent(doc, anchor, anchorXPath);
    case "update_book_date":
      // Date text usually sits as a sibling span/td near the book-name anchor
      return deriveUpdateDate(doc, anchor, anchorXPath);
  }
}

// ── chapter_name ── 核心：路径泛化，去掉行索引 ─────────────────────────────────

function deriveChapterName(
  doc: Document,
  anchor: Element,
  anchorXPath: string,
  keywordType: KeywordType,
): string {
  // 找到 <a> 元素（章节名称所在）
  const aEl = keywordType === "href"
    ? (anchor.tagName === "A" ? anchor : anchor.closest("a"))
    : (anchor.tagName === "A" ? anchor : anchor.closest("a") ?? anchor);

  if (aEl) {
    // 从列表容器生成泛化路径
    const generalized = buildGeneralizedListPath(doc, aEl, "/text()");
    if (generalized) return generalized;
    return buildAbsoluteXPath(doc, aEl) + "/text()";
  }

  // fallback: 找 row 中的 <a>
  const row = findRowContainer(anchor);
  if (row) {
    const listPath = buildGeneralizedListPath(doc, row, "//a/text()");
    if (listPath) return listPath;
    return buildAbsoluteXPath(doc, row) + "//a/text()";
  }

  return `${anchorXPath}/text()`;
}

// ── chapter_url ── 同上，提取 href ─────────────────────────────────────────────

function deriveChapterUrl(
  doc: Document,
  anchor: Element,
  anchorXPath: string,
  keywordType: KeywordType,
): string {
  const aEl = keywordType === "href"
    ? (anchor.tagName === "A" ? anchor : anchor.closest("a"))
    : (anchor.tagName === "A" ? anchor : anchor.closest("a"));

  if (aEl) {
    const generalized = buildGeneralizedListPath(doc, aEl, "/@href");
    if (generalized) return generalized;
    return buildAbsoluteXPath(doc, aEl) + "/@href";
  }

  const row = findRowContainer(anchor);
  if (row) {
    const listPath = buildGeneralizedListPath(doc, row, "//a/@href");
    if (listPath) return listPath;
    return buildAbsoluteXPath(doc, row) + "//a/@href";
  }

  return `${anchorXPath}/following-sibling::a/@href`;
}

// ── book_name ── 全局扫描页面 h1/h2，修复了 doc 混用 bug ──────────────────────

function deriveBookName(doc: Document): string {
  // 按优先级尝试常见书名容器
  const candidates = [
    "//h1[contains(@class,'book')]/text()",
    "//h1[contains(@class,'title')]/text()",
    "//h1[contains(@id,'book')]/text()",
    "//div[contains(@class,'bookname')]//h1/text()",
    "//div[contains(@class,'book-info')]//h1/text()",
    "//div[contains(@class,'bookinfo')]//h1/text()",
    "//div[contains(@class,'book_info')]//h1/text()",
    "//div[contains(@class,'intro')]//h1/text()",
    "//h1/text()",
    "//h2/text()",
  ];

  for (const xpath of candidates) {
    try {
      const r = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const text = r.singleNodeValue?.textContent?.trim();
      if (text && text.length > 1 && text.length < 60) return xpath;
    } catch { /* skip */ }
  }

  return "//h1/text()";
}

// ── novel_content ── 多维度打分，不再只看字符数 ────────────────────────────────

function deriveNovelContent(
  doc: Document,
  anchor: Element,
  anchorXPath: string,
): string {
  // 向上遍历最多 10 层，对每一层打分
  const candidates: Array<{ el: Element; score: number }> = [];

  let el: Element | null = anchor;
  for (let depth = 0; depth < 10 && el; depth++) {
    const tag = el.tagName.toLowerCase();
    if (!["div", "article", "section", "main"].includes(tag)) {
      el = el.parentElement;
      continue;
    }
    const score = scoreContentElement(el);
    if (score > 0) candidates.push({ el, score });
    el = el.parentElement;
  }

  if (candidates.length > 0) {
    const best = candidates.reduce((a, b) => (a.score > b.score ? a : b));
    return buildAbsoluteXPath(doc, best.el) + "/text()";
  }

  // 全局模式扫描（用 doc，修复原有 document 混用）
  const patterns = [
    "//div[@id='content']/text()",
    "//div[@id='booktxt']/text()",
    "//div[@id='chaptercontent']/text()",
    "//div[@id='txt']/text()",
    "//div[contains(@class,'content')]/text()",
    "//div[contains(@class,'chapter-content')]/text()",
    "//div[contains(@class,'txt')]/text()",
    "//div[contains(@class,'read-content')]/text()",
    "//article//p/text()",
    "//article/text()",
  ];

  for (const p of patterns) {
    try {
      const r = doc.evaluate(p, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const text = r.singleNodeValue?.textContent?.trim();
      if (text && text.length > 50) return p;
    } catch { /* skip */ }
  }

  return `${anchorXPath}/parent::*/text()`;
}

// ── update_book_date ── 从行容器内找日期类文本节点 ────────────────────────────

/**
 * 更新日期通常是行里的一个 span/td，文本是日期格式（如 2024-01-01）。
 * 策略：在锚元素所在的行容器里，找第一个非链接的纯文本节点，生成泛化路径。
 */
function deriveUpdateDate(
  doc: Document,
  anchor: Element,
  anchorXPath: string,
): string {
  const row = findRowContainer(anchor);
  if (!row) return `${anchorXPath}/following-sibling::*/text()`;

  // Look for span/td/div siblings of the anchor that look like dates
  const dateCandidates = ["span", "td", "em", "i", "small", "time"];
  for (const tag of dateCandidates) {
    const nodes = row.querySelectorAll(tag);
    for (const node of nodes) {
      const text = node.textContent?.trim() ?? "";
      // Simple date-like heuristic: contains digits and separators
      if (/\d{4}[-/年]\d{1,2}/.test(text) || /\d{1,2}[-/月]\d{1,2}/.test(text)) {
        const generalized = buildGeneralizedListPath(doc, node, "/text()");
        if (generalized) return generalized;
      }
    }
  }

  // Fallback: any sibling text node after the <a>
  const listPath = buildGeneralizedListPath(doc, row, "/span/text()");
  if (listPath) return listPath;
  return buildAbsoluteXPath(doc, row) + "/span/text()";
}

/**
 * 对一个候选正文容器打分（越高越可能是正文区域）
 * - 文本长度（主要指标，但有上限防止整页 div）
 * - 包含 <p> 标签（中文小说常用）
 * - 不含导航关键词
 * - id/class 含有 content/txt/read 等语义词
 */
function scoreContentElement(el: Element): number {
  const text = el.textContent?.trim() ?? "";
  if (text.length < 100) return 0;

  let score = 0;

  // 文本长度打分（200-5000 最佳，太长可能是整页）
  const len = text.length;
  if (len >= 200 && len <= 5000)  score += 30;
  else if (len > 5000 && len <= 20000) score += 15;
  else if (len > 20000) score += 5; // 太大，可能是整个 body

  // 含有 <p> 子节点
  const pCount = el.querySelectorAll("p").length;
  if (pCount >= 3)  score += 25;
  else if (pCount >= 1) score += 10;

  // 导航词惩罚
  const NAV_WORDS = ["上一章", "下一章", "目录", "返回", "书架", "登录", "注册"];
  for (const w of NAV_WORDS) {
    if (text.includes(w)) score -= 8;
  }

  // id/class 语义词加分
  const idCls = ((el.getAttribute("id") ?? "") + " " + (el.getAttribute("class") ?? "")).toLowerCase();
  for (const w of ["content", "txt", "read", "article", "chapter", "text", "novel"]) {
    if (idCls.includes(w)) { score += 20; break; }
  }
  // 导航类 id/class 惩罚
  for (const w of ["nav", "menu", "header", "footer", "side", "ad", "comment", "recommend"]) {
    if (idCls.includes(w)) { score -= 30; break; }
  }

  return score;
}

// ─── 路径泛化：核心功能 ───────────────────────────────────────────────────────

/**
 * 从目标元素（锚行或 <a>）向上找列表容器，
 * 去掉行的位置索引，生成覆盖同级所有行的泛化路径。
 *
 * 例：
 *   anchor <a> 在 <li> 下，<li> 的父是 <ul id="list">
 *   → //ul[@id="list"]/li/a/text()
 *   而不是 //ul[@id="list"]/li[3]/a/text()
 */
function buildGeneralizedListPath(
  doc: Document,
  anchorEl: Element,
  suffix: string,
): string | null {
  const row = findRowContainer(anchorEl);
  if (!row) return null;
  const listContainer = row.parentElement;
  if (!listContainer) return null;

  // 列表容器本身的路径（带 id/class 锚定）
  const containerPath = buildAbsoluteXPath(doc, listContainer);
  const rowTag = row.tagName.toLowerCase();

  // anchorEl 相对于 row 的路径（不含位置索引）
  const innerPath = buildPathFromRowToEl(row, anchorEl);

  // 如果 anchorEl 就是 row 自身（不常见）
  if (!innerPath) {
    return `${containerPath}/${rowTag}${suffix}`;
  }

  return `${containerPath}/${rowTag}/${innerPath}${suffix}`;
}

/**
 * 构建从 row 到 anchorEl 的相对路径（不含位置索引）。
 * 例：row=li, anchorEl=a → "a"
 *     row=li, anchorEl=span inside a → "a/span"（不常见）
 */
function buildPathFromRowToEl(row: Element, target: Element): string | null {
  if (row === target) return null;

  const parts: string[] = [];
  let cur: Element | null = target;

  while (cur && cur !== row) {
    parts.unshift(cur.tagName.toLowerCase());
    cur = cur.parentElement;
    if (!cur) return null; // target is not inside row
  }

  return parts.join("/");
}

// ─── DOM helpers ───────────────────────────────────────────────────────────────

function resolveElement(node: Node): Element | null {
  if (node.nodeType === Node.ATTRIBUTE_NODE) return (node as Attr).ownerElement;
  if (node.nodeType === Node.TEXT_NODE)      return node.parentElement;
  if (node.nodeType === Node.ELEMENT_NODE)   return node as Element;
  return null;
}

function hasAncestorTag(el: Element, tags: Set<string>): boolean {
  let cur: Element | null = el.parentElement;
  while (cur) {
    if (tags.has(cur.tagName.toLowerCase())) return true;
    cur = cur.parentElement;
  }
  return false;
}

function countSameTags(parent: Element, tagName: string): number {
  let count = 0;
  for (const child of parent.children) {
    if (child.tagName === tagName) count++;
  }
  return count;
}

/** 找最近的"行容器"祖先（li / tr / dd / dt 或带行语义 class 的 div） */
function findRowContainer(el: Element): Element | null {
  const ROW_TAGS = new Set(["li", "tr", "dd", "dt"]);
  const ROW_CLASS_HINTS = ["item", "row", "entry", "list-item", "novel", "book", "chapter"];

  let cur: Element | null = el.tagName === "A" ? el.parentElement : el;
  for (let i = 0; i < 8 && cur; i++) {
    const tag = cur.tagName.toLowerCase();
    if (ROW_TAGS.has(tag)) return cur;
    const cls = cur.getAttribute("class") ?? "";
    if (ROW_CLASS_HINTS.some((h) => cls.toLowerCase().includes(h))) return cur;
    cur = cur.parentElement;
  }
  return el.parentElement;
}

/**
 * 构建元素的绝对 XPath，优先使用 id，其次用 class，最后用位置索引。
 * 一旦遇到 id 就停止向上追溯（锚点够用）。
 */
function buildAbsoluteXPath(doc: Document, el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;

  while (cur && cur !== doc.documentElement) {
    const tag = cur.tagName.toLowerCase();
    const id = cur.getAttribute("id");
    const cls = cur.getAttribute("class")?.split(/\s+/).filter(Boolean)[0];

    if (id) {
      parts.unshift(`//${tag}[@id="${id}"]`);
      break; // id 是唯一锚点，不再向上
    }
    if (cls && parts.length === 0) {
      // 仅对最深元素用 class 简写，避免 class 组合路径不稳定
      parts.unshift(`//${tag}[contains(@class,"${cls}")]`);
      break;
    }

    // 位置索引（仅在没有更好锚点时使用）
    let idx = 1;
    let sib = cur.previousElementSibling;
    while (sib) {
      if (sib.tagName === cur.tagName) idx++;
      sib = sib.previousElementSibling;
    }
    parts.unshift(idx > 1 ? `${tag}[${idx}]` : tag);
    cur = cur.parentElement;
  }

  if (parts.length === 0) return `//${el.tagName.toLowerCase()}`;
  if (parts[0].startsWith("//")) return parts.join("/");
  return "/" + parts.join("/");
}

/** 取元素的短路径（仅 tag + id/class，用于交叉验证比对） */
function getShortPath(doc: Document, el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.getAttribute("id");
  const cls = el.getAttribute("class")?.split(/\s+/).filter(Boolean)[0];
  if (id)  return `${tag}#${id}`;
  if (cls) return `${tag}.${cls}`;
  const path = buildAbsoluteXPath(doc, el);
  return path.slice(0, 40);
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
    const snap = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
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

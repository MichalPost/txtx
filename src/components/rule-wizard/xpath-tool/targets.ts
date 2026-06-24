import type { KeywordType, TargetField } from "./types";
import { buildAbsoluteXPath, buildGeneralizedListPath, findRowContainer } from "./domHelpers";

export function deriveTargetXPath(
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
      return deriveUpdateDate(doc, anchor, anchorXPath);
    default:
      return "";
  }
}

function deriveChapterName(
  doc: Document,
  anchor: Element,
  anchorXPath: string,
  keywordType: KeywordType,
): string {
  const aEl =
    keywordType === "href"
      ? anchor.tagName === "A"
        ? anchor
        : anchor.closest("a")
      : anchor.tagName === "A"
        ? anchor
        : (anchor.closest("a") ?? anchor);

  if (aEl) {
    const generalized = buildGeneralizedListPath(doc, aEl, "/text()");
    if (generalized) return generalized;
    return buildAbsoluteXPath(doc, aEl) + "/text()";
  }

  const row = findRowContainer(anchor);
  if (row) {
    const listPath = buildGeneralizedListPath(doc, row, "//a/text()");
    if (listPath) return listPath;
    return buildAbsoluteXPath(doc, row) + "//a/text()";
  }

  return `${anchorXPath}/text()`;
}

function deriveChapterUrl(
  doc: Document,
  anchor: Element,
  anchorXPath: string,
  keywordType: KeywordType,
): string {
  const aEl =
    keywordType === "href"
      ? anchor.tagName === "A"
        ? anchor
        : anchor.closest("a")
      : anchor.tagName === "A"
        ? anchor
        : anchor.closest("a");

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

function deriveBookName(doc: Document): string {
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
    } catch {
      /* skip */
    }
  }

  return "//h1/text()";
}

function deriveNovelContent(doc: Document, anchor: Element, anchorXPath: string): string {
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
    } catch {
      /* skip */
    }
  }

  return `${anchorXPath}/parent::*/text()`;
}

function deriveUpdateDate(doc: Document, anchor: Element, anchorXPath: string): string {
  const row = findRowContainer(anchor);
  if (!row) return `${anchorXPath}/following-sibling::*/text()`;

  const dateCandidates = ["span", "td", "em", "i", "small", "time"];
  for (const tag of dateCandidates) {
    const nodes = row.querySelectorAll(tag);
    for (const node of Array.from(nodes)) {
      const text = node.textContent?.trim() ?? "";
      if (/\d{4}[-/年]\d{1,2}/.test(text) || /\d{1,2}[-/月]\d{1,2}/.test(text)) {
        const generalized = buildGeneralizedListPath(doc, node, "/text()");
        if (generalized) return generalized;
      }
    }
  }

  const listPath = buildGeneralizedListPath(doc, row, "/span/text()");
  if (listPath) return listPath;
  return buildAbsoluteXPath(doc, row) + "/span/text()";
}

function scoreContentElement(el: Element): number {
  const text = el.textContent?.trim() ?? "";
  if (text.length < 100) return 0;

  let score = 0;

  const len = text.length;
  if (len >= 200 && len <= 5000) score += 30;
  else if (len > 5000 && len <= 20000) score += 15;
  else if (len > 20000) score += 5;

  const pCount = el.querySelectorAll("p").length;
  if (pCount >= 3) score += 25;
  else if (pCount >= 1) score += 10;

  const NAV_WORDS = ["上一章", "下一章", "目录", "返回", "书架", "登录", "注册"];
  for (const w of NAV_WORDS) {
    if (text.includes(w)) score -= 8;
  }

  const idCls = (
    (el.getAttribute("id") ?? "") +
    " " +
    (el.getAttribute("class") ?? "")
  ).toLowerCase();
  for (const w of ["content", "txt", "read", "article", "chapter", "text", "novel"]) {
    if (idCls.includes(w)) {
      score += 20;
      break;
    }
  }
  for (const w of ["nav", "menu", "header", "footer", "side", "ad", "comment", "recommend"]) {
    if (idCls.includes(w)) {
      score -= 30;
      break;
    }
  }

  return score;
}

import type { KeywordType } from "./types";
import { countSameTags, findRowContainer, getShortPath } from "./domHelpers";

export function selectBestAnchor(
  doc: Document,
  anchorElements: Element[],
  kwList: string[],
  keywordType: KeywordType,
): Element {
  if (anchorElements.length === 1) return anchorElements[0];

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

  if (kwList.length > 1) {
    const listContainerPaths = kwList.map((kw) => {
      const anchor = anchorElements.find((el) => {
        const text =
          keywordType === "href"
            ? (el.getAttribute("href") ?? "")
            : keywordType === "class"
              ? (el.getAttribute("class") ?? "")
              : (el.textContent ?? "");
        return text.includes(kw);
      });
      if (!anchor) return null;
      const row = findRowContainer(anchor);
      return row?.parentElement ? getShortPath(doc, row.parentElement) : null;
    });

    const nonNull = listContainerPaths.filter(Boolean);
    if (nonNull.length > 1 && new Set(nonNull).size === 1) {
      return anchorElements[0];
    }
  }

  return best;
}

export function buildAnchorXPath(keywords: string[], type: KeywordType): string {
  if (keywords.length === 1) return buildSingleAnchorXPath(keywords[0], type);

  let predicate: string;
  switch (type) {
    case "text":
      predicate = keywords.map((k) => `contains(normalize-space(.),"${k}")`).join(" or ");
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
      return `//a[contains(normalize-space(.),"${kw}")]`;
    case "href":
      return `//a[contains(@href,"${kw}")]`;
    case "class":
      return `//*[contains(@class,"${kw}")]`;
  }
}

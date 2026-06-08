import { buildAnchorXPath, selectBestAnchor } from "./anchor";
import { hasAncestorTag, resolveElement } from "./domHelpers";
import { deriveTargetXPath } from "./targets";
import type { KeywordType, TargetField, XPathToolResult } from "./types";

export function generateXPathFromKeyword(
  html: string,
  keywords: string | string[],
  keywordType: KeywordType,
  targets: TargetField[],
  customAnchorXPath?: string,
): XPathToolResult {
  const kwList = (Array.isArray(keywords) ? keywords : [keywords]).filter((k) => k.trim());
  if (!kwList.length) {
    return {
      anchor_xpath: "",
      generated: {},
      anchor_count: 0,
      anchor_samples: [],
      error: "请输入定位关键字",
    };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const anchorXPath = customAnchorXPath?.trim() || buildAnchorXPath(kwList, keywordType);

    let anchorSnap: XPathResult;
    try {
      anchorSnap = doc.evaluate(
        anchorXPath,
        doc,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null,
      );
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

    const NOISE_TAGS = new Set(["script", "style", "noscript", "head", "meta", "link"]);
    const NOISE_ANCESTORS = new Set(["nav", "header", "footer", "aside"]);

    const anchorElements: Element[] = [];
    const anchorSamples: string[] = [];

    for (let i = 0; i < anchorSnap.snapshotLength; i++) {
      const node = anchorSnap.snapshotItem(i);
      if (!node) continue;
      const el = resolveElement(node);
      if (!el) continue;

      if (NOISE_TAGS.has(el.tagName.toLowerCase())) continue;
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

    const bestAnchor = selectBestAnchor(doc, anchorElements, kwList, keywordType);

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

export interface AdCleanupRules {
  enabled: boolean;
  xpath_rules: string[];
  regex_rules: string[];
  nav_keywords: string[];
  /** 删除正文头部 N 行（非空行计数）*/
  trim_head: number;
  /** 删除正文尾部 N 行（非空行计数）*/
  trim_tail: number;
}

export interface AdCleanupMatch {
  kind: "xpath" | "regex" | "nav" | "trim_head" | "trim_tail";
  rule: string;
  count: number;
  samples: string[];
  error?: string;
}

export interface AdCleanupPreview {
  originalText: string;
  cleanedText: string;
  removedLines: number;
  matches: AdCleanupMatch[];
}

export interface ChapterContentPreview {
  text: string;
  usedRule: string;
  lineCount: number;
  sourceCount: number;
}

export function emptyAdCleanupRules(): AdCleanupRules {
  return {
    enabled: true,
    xpath_rules: [],
    regex_rules: [],
    nav_keywords: [],
    trim_head: 0,
    trim_tail: 0,
  };
}

export function normalizeAdCleanupRules(value?: Partial<AdCleanupRules>): AdCleanupRules {
  return {
    enabled: value?.enabled ?? true,
    xpath_rules: uniqueNonEmpty(value?.xpath_rules ?? []),
    regex_rules: uniqueNonEmpty(value?.regex_rules ?? []),
    nav_keywords: uniqueNonEmpty(value?.nav_keywords ?? []),
    trim_head: Math.max(0, Math.floor(value?.trim_head ?? 0)),
    trim_tail: Math.max(0, Math.floor(value?.trim_tail ?? 0)),
  };
}

export function buildAdCleanupPreview(
  html: string,
  rules: AdCleanupRules,
  sourceText?: string,
): AdCleanupPreview {
  const originalLines = sourceText ? splitReadableLines(sourceText) : extractReadableLines(html);
  let lines = [...originalLines];
  const matches: AdCleanupMatch[] = [];

  for (const xpath of rules.xpath_rules.filter(Boolean)) {
    const result = evaluateXPathRule(html, xpath);
    matches.push(result);
    if (!result.error && result.samples.length > 0) {
      const remove = new Set(result.samples.map(normalizeLine));
      lines = lines.filter((line) => !remove.has(normalizeLine(line)));
    }
  }

  for (const pattern of rules.regex_rules.filter(Boolean)) {
    const before = lines.length;
    try {
      const re = new RegExp(pattern, "i");
      const samples = lines.filter((line) => re.test(line)).slice(0, 5);
      lines = lines.filter((line) => !re.test(line));
      matches.push({ kind: "regex", rule: pattern, count: before - lines.length, samples });
    } catch (e) {
      matches.push({ kind: "regex", rule: pattern, count: 0, samples: [], error: String(e) });
    }
  }

  for (const keyword of rules.nav_keywords.filter(Boolean)) {
    let count = 0;
    const samples: string[] = [];
    while (lines.length > 0) {
      const last = lines.at(-1) ?? "";
      if (!last.includes(keyword)) break;
      samples.push(last);
      lines.pop();
      count += 1;
    }
    matches.push({ kind: "nav", rule: keyword, count, samples: samples.slice(0, 5) });
  }

  // trim_head: 删除头部 N 行
  const trimHead = rules.trim_head ?? 0;
  if (trimHead > 0) {
    const actual = Math.min(trimHead, lines.length);
    const samples = lines.slice(0, actual);
    lines = lines.slice(actual);
    matches.push({ kind: "trim_head", rule: `头部 ${trimHead} 行`, count: actual, samples: samples.slice(0, 5) });
  }

  // trim_tail: 删除尾部 N 行
  const trimTail = rules.trim_tail ?? 0;
  if (trimTail > 0) {
    const actual = Math.min(trimTail, lines.length);
    const samples = lines.slice(lines.length - actual);
    lines = lines.slice(0, lines.length - actual);
    matches.push({ kind: "trim_tail", rule: `尾部 ${trimTail} 行`, count: actual, samples: samples.slice(0, 5) });
  }

  return {
    originalText: originalLines.join("\n"),
    cleanedText: lines.join("\n"),
    removedLines: Math.max(0, originalLines.length - lines.length),
    matches,
  };
}

export function buildChapterContentPreview(
  html: string,
  primaryXPath: string,
  fallbackXPaths: string[],
): ChapterContentPreview {
  const rules = [primaryXPath, ...fallbackXPaths].map((rule) => rule.trim()).filter(Boolean);
  for (const rule of rules) {
    const lines = evaluateXPathTextLines(html, rule);
    if (lines.length > 0) {
      return {
        text: lines.join("\n"),
        usedRule: rule,
        lineCount: lines.length,
        sourceCount: lines.length,
      };
    }
  }
  return { text: "", usedRule: "", lineCount: 0, sourceCount: 0 };
}

/**
 * 多页章节合并预览（模拟 Rust download_chapter_with_pagination 逻辑）
 *
 * 从已缓存的第一页 HTML 开始，提取正文后，若配置了 nextPageXPath 则
 * 继续抓取后续页，最多合并 MAX_PAGES 页，返回合并后的文本。
 *
 * @param firstPageHtml  第一页已缓存的 HTML
 * @param firstPageUrl   第一页 URL（用于解析相对链接）
 * @param contentXPath   正文内容 XPath
 * @param fallbackXPaths 正文备用 XPath 列表
 * @param nextPageXPath  下一页链接 XPath（空则单页）
 * @param fetchHtml      抓取任意 URL 并返回 HTML 的函数
 * @returns              合并后的正文文本及元数据
 */
export async function buildMultiPageContentPreview(
  firstPageHtml: string,
  firstPageUrl: string,
  contentXPath: string,
  fallbackXPaths: string[],
  nextPageXPath: string,
  fetchHtml: (url: string) => Promise<string>,
): Promise<{ text: string; usedRule: string; pageCount: number; lineCount: number }> {
  const MAX_PAGES = 5; // 预览限制 5 页，避免过慢
  const rules = [contentXPath, ...fallbackXPaths].map((r) => r.trim()).filter(Boolean);

  // 找到能命中内容的规则
  let usedRule = "";
  for (const rule of rules) {
    const lines = evaluateXPathTextLines(firstPageHtml, rule);
    if (lines.length > 0) { usedRule = rule; break; }
  }
  if (!usedRule) return { text: "", usedRule: "", pageCount: 1, lineCount: 0 };

  const allLines: string[] = evaluateXPathTextLines(firstPageHtml, usedRule);
  let currentHtml = firstPageHtml;
  let currentUrl = firstPageUrl;
  let pageCount = 1;

  if (nextPageXPath.trim()) {
    while (pageCount < MAX_PAGES) {
      // 解析下一页链接
      const nextUrls = evaluateXPathTextLines(currentHtml, nextPageXPath);
      const rawNext = nextUrls[0]?.trim() ?? "";
      if (!rawNext || rawNext === currentUrl) break;

      // 解析相对 URL
      let nextUrl: string;
      try {
        nextUrl = new URL(rawNext, currentUrl).href;
      } catch {
        break;
      }
      if (nextUrl === currentUrl) break;

      try {
        const nextHtml = await fetchHtml(nextUrl);
        const nextLines = evaluateXPathTextLines(nextHtml, usedRule);
        if (nextLines.length === 0) break;
        allLines.push(...nextLines);
        currentHtml = nextHtml;
        currentUrl = nextUrl;
        pageCount += 1;
      } catch {
        break;
      }
    }
  }

  return {
    text: allLines.join("\n"),
    usedRule,
    pageCount,
    lineCount: allLines.length,
  };
}

export function suggestAdCleanupRules(html: string): AdCleanupRules {
  return suggestAdCleanupRulesFromText(extractReadableLines(html).join("\n"), html);
}

export function suggestAdCleanupRulesFromText(text: string, html = ""): AdCleanupRules {
  const lines = splitReadableLines(text);
  const regex_rules = [
    /https?:\/\/[^\s]+|www\.[^\s]+/i,
    /加群|QQ群|微信|公众号|手機閱讀|手机阅读|收藏本站/i,
    /请记住|請記住|最新网址|最新網址|更新最快/i,
  ]
    .filter((re) => lines.some((line) => re.test(line)))
    .map((re) => re.source);

  const nav_keywords = ["上一章", "下一章", "返回目录", "章节目录", "上一節", "下一節", "返回目錄"].filter(
    (kw) => lines.slice(-8).some((line) => line.includes(kw)),
  );

  return normalizeAdCleanupRules({
    enabled: true,
    xpath_rules: html ? detectAdXPathRules(html) : [],
    regex_rules,
    nav_keywords,
  });
}

function evaluateXPathTextLines(html: string, xpath: string): string[] {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const snap = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const lines: string[] = [];
    for (let i = 0; i < snap.snapshotLength; i += 1) {
      const node = snap.snapshotItem(i);
      const text = (node?.textContent ?? (node as Attr | null)?.value ?? "").trim();
      if (text) lines.push(...splitReadableLines(text));
    }
    return lines;
  } catch {
    return [];
  }
}

function evaluateXPathRule(html: string, xpath: string): AdCleanupMatch {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const snap = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const samples: string[] = [];
    for (let i = 0; i < snap.snapshotLength; i += 1) {
      const node = snap.snapshotItem(i);
      const text = (node?.textContent ?? (node as Attr | null)?.value ?? "").trim();
      if (text) samples.push(...splitReadableLines(text));
    }
    return { kind: "xpath", rule: xpath, count: snap.snapshotLength, samples: samples.slice(0, 5) };
  } catch (e) {
    return { kind: "xpath", rule: xpath, count: 0, samples: [], error: String(e) };
  }
}

function extractReadableLines(html: string): string[] {
  if (!html.trim()) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const el of Array.from(doc.querySelectorAll("script,style,noscript"))) el.remove();
  const text = doc.body?.textContent ?? doc.documentElement.textContent ?? html;
  return splitReadableLines(text);
}

function splitReadableLines(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function detectAdXPathRules(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rules = new Set<string>();
  const selectors = [
    ["id", /ad|ads|advert|banner|notice/i],
    ["class", /ad|ads|advert|banner|notice/i],
  ] as const;

  for (const [attr, re] of selectors) {
    for (const el of Array.from(doc.querySelectorAll(`[${attr}]`)).slice(0, 80)) {
      const value = el.getAttribute(attr) ?? "";
      if (!re.test(value)) continue;
      const tag = el.tagName.toLowerCase();
      rules.add(`//${tag}[contains(@${attr},"${value.split(/\s+/)[0]}")]/text()`);
    }
  }

  return Array.from(rules).slice(0, 6);
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

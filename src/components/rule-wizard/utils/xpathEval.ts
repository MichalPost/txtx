/**
 * 共用 XPath 执行工具 — Step1UpdateList / StepCatalog / Step2ListRules 共用
 */

/** 在 HTML 字符串中执行 XPath，返回所有命中文本/属性值 */
export function evalXPathAll(html: string, xpath: string): string[] {
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

/** 解析相对/绝对 URL */
export function resolveUrl(href: string, base: string): string {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

export interface UpdateListBookItem {
  name: string;
  url: string;
  date?: string;
}

/** 将 names + urls + dates 合并为书籍列表 */
export function mergeBooks(
  names: string[],
  urls: string[],
  dates: string[],
  base: string,
): UpdateListBookItem[] {
  const len = Math.min(names.length, urls.length);
  const books: UpdateListBookItem[] = [];
  for (let i = 0; i < len; i++) {
    const name = names[i]?.trim();
    const url = resolveUrl(urls[i]?.trim() ?? "", base);
    if (name && url) books.push({ name, url, date: dates[i]?.trim() });
  }
  return books;
}

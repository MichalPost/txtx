export function resolveElement(node: Node): Element | null {
  if (node.nodeType === Node.ATTRIBUTE_NODE) return (node as Attr).ownerElement;
  if (node.nodeType === Node.TEXT_NODE) return node.parentElement;
  if (node.nodeType === Node.ELEMENT_NODE) return node as Element;
  return null;
}

export function hasAncestorTag(el: Element, tags: Set<string>): boolean {
  let cur: Element | null = el.parentElement;
  while (cur) {
    if (tags.has(cur.tagName.toLowerCase())) return true;
    cur = cur.parentElement;
  }
  return false;
}

export function countSameTags(parent: Element, tagName: string): number {
  let count = 0;
  for (const child of Array.from(parent.children)) {
    if (child.tagName === tagName) count++;
  }
  return count;
}

export function findRowContainer(el: Element): Element | null {
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

export function buildAbsoluteXPath(doc: Document, el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;

  while (cur && cur !== doc.documentElement) {
    const tag = cur.tagName.toLowerCase();
    const id = cur.getAttribute("id");
    const cls = cur.getAttribute("class")?.split(/\s+/).filter(Boolean)[0];

    if (id) {
      parts.unshift(`//${tag}[@id="${id}"]`);
      break;
    }
    if (cls && parts.length === 0) {
      parts.unshift(`//${tag}[contains(@class,"${cls}")]`);
      break;
    }

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

export function getShortPath(doc: Document, el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.getAttribute("id");
  const cls = el.getAttribute("class")?.split(/\s+/).filter(Boolean)[0];
  if (id) return `${tag}#${id}`;
  if (cls) return `${tag}.${cls}`;
  const path = buildAbsoluteXPath(doc, el);
  return path.slice(0, 40);
}

export function buildGeneralizedListPath(
  doc: Document,
  anchorEl: Element,
  suffix: string,
): string | null {
  const row = findRowContainer(anchorEl);
  if (!row) return null;
  const listContainer = row.parentElement;
  if (!listContainer) return null;

  const containerPath = buildAbsoluteXPath(doc, listContainer);
  const rowTag = row.tagName.toLowerCase();
  const innerPath = buildPathFromRowToEl(row, anchorEl);

  if (!innerPath) {
    return `${containerPath}/${rowTag}${suffix}`;
  }

  return `${containerPath}/${rowTag}/${innerPath}${suffix}`;
}

function buildPathFromRowToEl(row: Element, target: Element): string | null {
  if (row === target) return null;

  const parts: string[] = [];
  let cur: Element | null = target;

  while (cur && cur !== row) {
    parts.unshift(cur.tagName.toLowerCase());
    cur = cur.parentElement;
    if (!cur) return null;
  }

  return parts.join("/");
}

import type { ValidationResult } from "./types";

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

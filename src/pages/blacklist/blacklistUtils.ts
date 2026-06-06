/** 导出关键词列表为 .txt 文件 */
export function exportKeywords(keywords: string[]): void {
  const content = keywords.join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "blacklist.txt";
  a.click();
  URL.revokeObjectURL(url);
}

/** 从文件读取关键词列表，与已有关键词合并去重 */
export function importKeywordsFromFile(
  file: File,
  existing: string[],
  onDone: (merged: string[]) => void,
): void {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const text = ev.target?.result as string;
    const newKws = text
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const merged = [...new Set([...existing, ...newKws])];
    onDone(merged);
  };
  reader.readAsText(file);
}

/** 共享的 inline input 样式，避免到处重复 */
export const inlineInputStyle = {
  background: "var(--color-surface-2)",
  borderColor: "var(--color-border)",
  color: "var(--color-text)",
} as const;

export const inlineInputClass =
  "border rounded-lg px-3 py-1.5 text-sm focus:outline-none transition-colors";

/** 标准 focus/blur 处理器（带光晕效果） */
export const inputFocusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--color-accent)";
    e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--color-border)";
    e.currentTarget.style.boxShadow = "none";
  },
};

/** 简版（无光晕）focus/blur 处理器 — 兼容 input 和 select */
export const inputFocusHandlersSimple = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = "var(--color-accent)";
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = "var(--color-border)";
  },
};

interface SourcePreviewProps {
  html: string;
  className?: string;
  maxHeight?: number;
}

export function SourcePreview({ html, className = "", maxHeight = 160 }: SourcePreviewProps) {
  if (!html) return null;

  return (
    <div
      className={`overflow-auto rounded-lg border p-2 font-mono text-xs leading-relaxed ${className}`}
      style={{
        background: "var(--color-surface-2)",
        borderColor: "var(--color-border)",
        maxHeight,
        color: "var(--color-text-muted)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}
    >
      {html.slice(0, 8000)}
      {html.length > 8000 && "\n\n… 已截断（仅显示前 8000 字符）"}
    </div>
  );
}

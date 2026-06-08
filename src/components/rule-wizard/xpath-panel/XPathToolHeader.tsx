import { ChevronRight, Wand2 } from "lucide-react";

interface XPathToolHeaderProps {
  adoptedCount: number;
  onApply: () => void;
  onClose: () => void;
}

export function XPathToolHeader({ adoptedCount, onApply, onClose }: XPathToolHeaderProps) {
  return (
    <div
      className="flex items-center gap-2 border-b px-4 py-3"
      style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
    >
      <Wand2 className="h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
      <span className="flex-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        XPath 生成工具
      </span>
      {adoptedCount > 0 && (
        <button
          onClick={onApply}
          className="flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          <ChevronRight className="h-3 w-3" />
          应用 {adoptedCount} 个
        </button>
      )}
      <button
        className="rounded px-2 py-1 text-xs transition-opacity hover:opacity-70"
        style={{ color: "var(--color-text-muted)" }}
        onClick={onClose}
      >
        收起
      </button>
    </div>
  );
}

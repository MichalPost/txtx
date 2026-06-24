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
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          XPath 生成工具
        </p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-subtle)" }}>
          先生成候选表达式，再勾选要应用的字段。
        </p>
      </div>
      {adoptedCount > 0 && (
        <button
          type="button"
          onClick={onApply}
          aria-label={`应用已选中的 ${adoptedCount} 个字段`}
          className="flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          <ChevronRight className="h-3 w-3" />
          应用 {adoptedCount} 个
        </button>
      )}
      <button
        type="button"
        className="rounded px-2 py-1 text-xs transition-opacity hover:opacity-70"
        style={{ color: "var(--color-text-muted)" }}
        onClick={onClose}
        aria-label="关闭 XPath 生成工具"
      >
        收起
      </button>
    </div>
  );
}

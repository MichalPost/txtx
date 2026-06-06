import { Plus, X } from "lucide-react";

import { inputFocusHandlers } from "@/pages/blacklist/blacklistUtils";

interface BulkAddPanelProps {
  bulkText: string;
  bulkValidCount: number;
  bulkInvalidCount: number;
  onTextChange: (v: string) => void;
  onAdd: () => void;
  onCancel: () => void;
}

export function BulkAddPanel({
  bulkText,
  bulkValidCount,
  bulkInvalidCount,
  onTextChange,
  onAdd,
  onCancel,
}: BulkAddPanelProps) {
  return (
    <div
      className="mb-3 flex flex-col gap-2 rounded-xl border p-3"
      style={{ background: "var(--color-surface-1)", borderColor: "var(--color-accent)" }}
    >
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        每行一条正则表达式，无效正则会自动跳过
      </p>
      <textarea
        rows={5}
        className="w-full resize-y rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none"
        style={{
          background: "var(--color-surface-2)",
          borderColor: "var(--color-border)",
          color: "var(--color-text)",
        }}
        placeholder={"广告文字.*\n\\[.*?\\]\n第.{1,3}章"}
        value={bulkText}
        onChange={(e) => onTextChange(e.target.value)}
        {...inputFocusHandlers}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {bulkValidCount} 条有效
          {bulkInvalidCount > 0 && (
            <span style={{ color: "var(--color-danger)" }}>
              {" "}· {bulkInvalidCount} 条无效将跳过
            </span>
          )}
        </span>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
          >
            <X className="h-3 w-3" /> 取消
          </button>
          <button
            onClick={onAdd}
            disabled={bulkValidCount === 0}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            <Plus className="h-3 w-3" /> 批量添加
          </button>
        </div>
      </div>
    </div>
  );
}

import { FileText } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          background: "var(--color-accent-muted)",
          border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
          boxShadow: "var(--shadow-accent)",
        }}
      >
        <FileText className="h-8 w-8" style={{ color: "var(--color-accent)" }} />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
          选择任务查看详情
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          从左侧选一个任务
        </p>
      </div>
    </div>
  );
}

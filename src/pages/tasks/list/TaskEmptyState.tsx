import { ListTodo } from "lucide-react";

export function TaskEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-8">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl"
        style={{
          background: "var(--color-accent-muted)",
          border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
        }}
      >
        <ListTodo className="h-6 w-6" style={{ color: "var(--color-accent)" }} />
      </div>
      <div className="text-center">
        <p className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
          还没有任务
        </p>
        <p className="mt-0.5 text-[10px]" style={{ color: "var(--color-text-subtle)" }}>
          点击「新建」开始
        </p>
      </div>
    </div>
  );
}

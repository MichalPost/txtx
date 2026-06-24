import { ListTodo, type LucideIcon } from "lucide-react";

interface TaskEmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export function TaskEmptyState({
  title = "还没有任务",
  description = "点击「新建」开始",
  icon: Icon = ListTodo,
  actions,
}: TaskEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-8">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl"
        style={{
          background: "var(--color-accent-muted)",
          border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
        }}
      >
        <Icon className="h-6 w-6" style={{ color: "var(--color-accent)" }} />
      </div>
      <div className="text-center">
        <p className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
          {title}
        </p>
        <p className="mt-0.5 text-[10px]" style={{ color: "var(--color-text-subtle)" }}>
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

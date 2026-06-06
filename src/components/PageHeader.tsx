import { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div
      className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b pb-4"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div>
        <h1 className="text-lg leading-tight font-semibold" style={{ color: "var(--color-text)" }}>
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-0.5 text-xs leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

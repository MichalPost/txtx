import { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div
      className="flex items-center justify-between shrink-0 flex-wrap gap-3 pb-4 border-b"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div>
        <h1
          className="text-lg font-semibold leading-tight"
          style={{ color: "var(--color-text)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="text-xs mt-0.5 leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}

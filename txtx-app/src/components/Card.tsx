import { type ReactNode } from "react";

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  actions?: ReactNode;
}

export function Card({ title, children, className = "", bodyClassName = "", actions }: CardProps) {
  return (
    <div
      className={`rounded-xl border ${className}`}
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {(title || actions) && (
        <div
          className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ borderColor: "var(--color-border)" }}
        >
          {title && (
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--color-text)" }}
            >
              {title}
            </h3>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

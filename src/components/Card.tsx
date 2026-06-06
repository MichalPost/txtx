import { type ReactNode } from "react";

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  actions?: ReactNode;
  /** Enable hover lift effect for interactive cards */
  hoverable?: boolean;
  /** Use a flatter inset style (no shadow, surface-2 bg) */
  inset?: boolean;
}

export function Card({
  title,
  children,
  className = "",
  bodyClassName = "",
  actions,
  hoverable = false,
  inset = false,
}: CardProps) {
  return (
    <div
      className={`rounded-[14px] border ${hoverable ? "cursor-pointer transition-all duration-150" : ""} ${className}`}
      style={{
        background: inset ? "var(--color-surface-2)" : "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: inset ? "none" : "var(--shadow-sm)",
      }}
      onMouseEnter={
        hoverable
          ? (e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = "var(--color-border-hover)";
              el.style.boxShadow = "var(--shadow-md)";
              el.style.transform = "translateY(-1px)";
            }
          : undefined
      }
      onMouseLeave={
        hoverable
          ? (e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = "var(--color-border)";
              el.style.boxShadow = inset ? "none" : "var(--shadow-sm)";
              el.style.transform = "";
            }
          : undefined
      }
    >
      {(title || actions) && (
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--color-border)" }}
        >
          {title && (
            <h3 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              {title}
            </h3>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

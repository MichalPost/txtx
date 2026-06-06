/**
 * 向导步骤中通用的 Section 卡片 wrapper
 */
import React from "react";

interface SectionProps {
  title: string;
  color?: string;
  badge?: string;
  children: React.ReactNode;
}

export function WizardSection({
  title,
  color = "var(--color-text-muted)",
  badge,
  children,
}: SectionProps) {
  return (
    <div
      className="flex flex-col gap-2.5 rounded-xl border p-3"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold" style={{ color }}>
          {title}
        </p>
        {badge && (
          <span
            className="rounded-full px-1.5 py-0.5 text-xs"
            style={{
              background: "var(--color-accent-muted)",
              color: "var(--color-accent)",
              fontSize: 10,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

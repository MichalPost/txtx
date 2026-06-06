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

export function WizardSection({ title, color = "var(--color-text-muted)", badge, children }: SectionProps) {
  return (
    <div
      className="flex flex-col gap-2.5 rounded-xl p-3 border"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold" style={{ color }}>{title}</p>
        {badge && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)", fontSize: 10 }}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

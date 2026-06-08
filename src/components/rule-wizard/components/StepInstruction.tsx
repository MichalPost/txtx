import type { ReactNode } from "react";

interface StepInstructionProps {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  variant?: "accent" | "muted";
}

export function StepInstruction({
  icon,
  title,
  children,
  variant = "accent",
}: StepInstructionProps) {
  if (variant === "muted") {
    return (
      <div
        className="rounded-xl px-4 py-3 text-xs"
        style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
      >
        <p className="mb-1 font-medium" style={{ color: "var(--color-text)" }}>
          {title}
        </p>
        <div>{children}</div>
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3"
      style={{
        background: "var(--color-accent-muted)",
        borderLeft: "2px solid var(--color-accent)",
      }}
    >
      {icon}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>
          {title}
        </p>
        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

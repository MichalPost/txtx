import { useState } from "react";

export function ActionButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
      style={{
        background: hov
          ? "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))"
          : "transparent",
        color: hov ? "var(--color-accent)" : "var(--color-text-muted)",
        border: "1px solid",
        borderColor: hov
          ? "color-mix(in srgb, var(--color-accent) 35%, transparent)"
          : "transparent",
        transform: hov ? "translateY(-0.5px)" : "none",
        transition: "all 120ms ease",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {children}
    </button>
  );
}

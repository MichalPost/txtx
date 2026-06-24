import { useState } from "react";

export function IconButton({
  onClick,
  title,
  color,
  hoverBg,
  children,
}: {
  onClick: () => void;
  title: string;
  color: string;
  hoverBg?: string;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-8 w-8 items-center justify-center rounded-lg transition-all"
      style={{
        color,
        background: hov && hoverBg ? hoverBg : hov ? "var(--color-surface-2)" : "transparent",
        opacity: hov ? 1 : 0.7,
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

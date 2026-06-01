import { type ButtonHTMLAttributes, type ReactNode, type CSSProperties } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const sizeClasses = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

function getVariantStyle(variant: ButtonProps["variant"]): CSSProperties {
  switch (variant) {
    case "primary":
      return {
        background: "var(--color-accent)",
        color: "#fff",
        border: "1px solid transparent",
        boxShadow: "var(--shadow-accent)",
      };
    case "secondary":
      return {
        background: "var(--color-surface-2)",
        color: "var(--color-text)",
        border: "1px solid var(--color-border)",
      };
    case "danger":
      return {
        background: "var(--color-danger)",
        color: "#fff",
        border: "1px solid transparent",
      };
    case "ghost":
      return {
        background: "transparent",
        color: "var(--color-text-muted)",
        border: "1px solid transparent",
      };
    default:
      return {};
  }
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{ ...getVariantStyle(variant), ...style }}
      className={`
        inline-flex items-center gap-2 rounded-lg font-medium transition-all cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed
        hover:opacity-90 active:scale-[0.98]
        ${sizeClasses[size]} ${className}
      `}
    >
      {children}
    </button>
  );
}

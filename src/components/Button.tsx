import { type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";

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
        boxShadow: "0 2px 8px rgba(192,57,43,0.22)",
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
  onMouseEnter,
  onMouseLeave,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled}
      style={{ ...getVariantStyle(variant), ...style }}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] font-medium transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-100 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] active:scale-[0.97] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-40 ${sizeClasses[size]} ${className} `}
      onMouseEnter={(e) => {
        if (!disabled) {
          const el = e.currentTarget;
          if (variant === "primary") {
            el.style.background = "var(--color-accent-hover)";
            el.style.transform = "translateY(-1px)";
            el.style.boxShadow = "var(--shadow-accent), 0 6px 20px rgba(45,36,25,0.08)";
          } else if (variant === "secondary") {
            el.style.background = "var(--color-border)";
            el.style.borderColor = "var(--color-border-hover)";
          } else if (variant === "danger") {
            el.style.opacity = "0.88";
            el.style.transform = "translateY(-1px)";
          } else if (variant === "ghost") {
            el.style.background = "var(--color-surface-2)";
            el.style.color = "var(--color-text)";
          }
        }
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          const el = e.currentTarget;
          const base = getVariantStyle(variant);
          el.style.background = (base.background as string) ?? "";
          el.style.transform = "";
          el.style.boxShadow = (base.boxShadow as string) ?? "";
          el.style.borderColor = "";
          el.style.opacity = "";
          if (variant === "ghost") el.style.color = "var(--color-text-muted)";
        }
        onMouseLeave?.(e);
      }}
    >
      {children}
    </button>
  );
}

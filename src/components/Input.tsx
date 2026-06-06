import { type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const baseStyle = {
  background: "var(--color-surface)",
  borderColor: "var(--color-border)",
  color: "var(--color-text)",
} as const;

const baseClass =
  "w-full border rounded-[10px] px-3 py-2 text-sm focus:outline-none transition-colors placeholder:text-[var(--color-text-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1";

export function Input({ label, error, className = "", style, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
          {label}
        </label>
      )}
      <input
        {...props}
        style={{
          ...baseStyle,
          ...(error ? { borderColor: "var(--color-danger)" } : {}),
          ...style,
        }}
        className={`${baseClass} ${className}`}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--color-accent)";
          e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? "var(--color-danger)" : "var(--color-border)";
          e.currentTarget.style.boxShadow = "none";
          props.onBlur?.(e);
        }}
      />
      {error && (
        <span className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

export function Textarea({ label, error, className = "", style, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
          {label}
        </label>
      )}
      <textarea
        {...props}
        style={{
          ...baseStyle,
          ...(error ? { borderColor: "var(--color-danger)" } : {}),
          ...style,
        }}
        className={`${baseClass} resize-none ${className}`}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--color-accent)";
          e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? "var(--color-danger)" : "var(--color-border)";
          e.currentTarget.style.boxShadow = "none";
          props.onBlur?.(e);
        }}
      />
      {error && (
        <span className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

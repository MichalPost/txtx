import React from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function Toggle({ checked, onChange, label, disabled, onClick }: ToggleProps) {
  return (
    <label
      className={`flex items-center gap-2 cursor-pointer select-none ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
      onClick={onClick}
    >
      <div
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onChange(!checked);
        }}
        className="relative w-9 h-5 rounded-full transition-colors"
        style={{
          background: checked ? "var(--color-accent)" : "var(--color-border)",
          boxShadow: checked ? "var(--shadow-accent)" : "none",
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
          style={{
            transform: checked ? "translateX(16px)" : "translateX(0)",
          }}
        />
      </div>
      {label && (
        <span className="text-sm" style={{ color: "var(--color-text)" }}>
          {label}
        </span>
      )}
    </label>
  );
}

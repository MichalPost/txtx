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
      className={`flex cursor-pointer items-center gap-2 select-none ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
      onClick={onClick}
    >
      <div
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onChange(!checked);
        }}
        className="relative h-5 w-9 rounded-full"
        style={{
          background: checked ? "var(--color-accent)" : "var(--color-border)",
          boxShadow: checked ? "var(--shadow-accent)" : "none",
          transition:
            "background 180ms cubic-bezier(0.16,1,0.3,1), box-shadow 180ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow"
          style={{
            transform: checked ? "translateX(16px)" : "translateX(0)",
            transition: "transform 180ms cubic-bezier(0.16,1,0.3,1)",
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

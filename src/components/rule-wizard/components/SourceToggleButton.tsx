import { Code2 } from "lucide-react";

interface SourceToggleButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

export function SourceToggleButton({ active, label, onClick }: SourceToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
      style={{
        background: active ? "var(--color-accent-muted)" : "var(--color-surface-1)",
        borderColor: active
          ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
          : "var(--color-border)",
        color: active ? "var(--color-accent)" : "var(--color-text-muted)",
      }}
    >
      <Code2 className="h-3 w-3" />
      {label}
    </button>
  );
}

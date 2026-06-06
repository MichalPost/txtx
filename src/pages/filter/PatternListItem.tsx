import { AlertCircle, CheckCircle2, Trash2 } from "lucide-react";

interface PatternListItemProps {
  pattern: string;
  isValid: boolean;
  onRemove: (p: string) => void;
}

export function PatternListItem({ pattern, isValid, onRemove }: PatternListItemProps) {
  return (
    <div
      className="group flex items-center gap-2 rounded-lg border px-3 py-1.5"
      style={{
        background: "var(--color-surface-2)",
        borderColor: isValid
          ? "var(--color-border)"
          : "color-mix(in srgb, var(--color-danger) 40%, transparent)",
      }}
    >
      {isValid ? (
        <CheckCircle2
          className="h-3 w-3 shrink-0 opacity-40"
          style={{ color: "var(--color-success, #22c55e)" }}
        />
      ) : (
        <AlertCircle className="h-3 w-3 shrink-0" style={{ color: "var(--color-danger)" }} />
      )}
      <code className="flex-1 truncate font-mono text-xs" style={{ color: "var(--color-accent)" }}>
        {pattern}
      </code>
      <button
        onClick={() => onRemove(pattern)}
        className="cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: "var(--color-text-muted)" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

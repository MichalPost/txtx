import type { ToolMode } from "./types";
import { TABS } from "./types";

export function ConverterTabs({
  mode,
  onModeChange,
}: {
  mode: ToolMode;
  onModeChange: (mode: ToolMode) => void;
}) {
  return (
    <div
      className="flex shrink-0 flex-wrap gap-0 border-b"
      style={{ borderColor: "var(--color-border)" }}
    >
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onModeChange(id)}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors"
          style={{
            color: mode === id ? "var(--color-accent)" : "var(--color-text-muted)",
            borderBottom: mode === id ? "2px solid var(--color-accent)" : "2px solid transparent",
            background: "transparent",
          }}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

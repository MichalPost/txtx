import type { FieldState } from "../hooks/useXPathFields";
import type { TargetField, XPathTarget } from "../xpathTool";

interface XPathFieldTabsProps {
  activeField: TargetField;
  availableTargets: XPathTarget[];
  fields: Record<TargetField, FieldState>;
  onSelect: (field: TargetField) => void;
}

export function XPathFieldTabs({
  activeField,
  availableTargets,
  fields,
  onSelect,
}: XPathFieldTabsProps) {
  return (
    <div
      className="flex shrink-0 border-b"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
    >
      {availableTargets.map((target) => {
        const active = activeField === target.field;
        const fieldState = fields[target.field];
        const statusColor = fieldState.generating
          ? "var(--color-accent)"
          : fieldState.error
            ? "var(--color-danger)"
            : fieldState.generatedXPath
              ? "var(--color-success)"
              : undefined;

        return (
          <button
            type="button"
            key={target.field}
            onClick={() => onSelect(target.field)}
            aria-pressed={active}
            aria-label={`切换到${target.label}`}
            className="flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-all"
            style={{
              background: active ? "var(--color-surface)" : "transparent",
              borderBottomColor: active ? "var(--color-accent)" : "transparent",
              color: active ? "var(--color-accent)" : statusColor ?? "var(--color-text-muted)",
              fontWeight: active ? 600 : 400,
            }}
          >
            {statusColor && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: statusColor }}
              />
            )}
            {target.label}
          </button>
        );
      })}
    </div>
  );
}

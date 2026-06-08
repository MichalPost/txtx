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
      {availableTargets.map((t) => {
        const active = activeField === t.field;
        const f = fields[t.field];
        const statusColor = f.generating
          ? "var(--color-accent)"
          : f.error
            ? "var(--color-danger)"
            : f.generatedXPath
              ? "var(--color-success)"
              : undefined;
        return (
          <button
            key={t.field}
            onClick={() => onSelect(t.field)}
            className="flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-all"
            style={{
              background: active ? "var(--color-surface)" : "transparent",
              borderBottomColor: active ? "var(--color-accent)" : "transparent",
              color: active ? "var(--color-accent)" : (statusColor ?? "var(--color-text-muted)"),
              fontWeight: active ? 600 : 400,
            }}
          >
            {statusColor && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: statusColor }} />
            )}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

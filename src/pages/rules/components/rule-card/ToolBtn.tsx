export function ToolBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all"
      style={{
        background: active
          ? "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))"
          : "var(--color-surface-2)",
        borderColor: active
          ? "color-mix(in srgb, var(--color-accent) 45%, transparent)"
          : "var(--color-border)",
        color: active ? "var(--color-accent)" : "var(--color-text-muted)",
        fontWeight: active ? 600 : 400,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function CounterPair({
  success,
  error,
  total,
}: {
  success: number;
  error: number;
  total?: number;
}) {
  const items: [string, number, string][] = [
    ["成功", success, "var(--color-success)"],
    ["失败", error, "var(--color-danger)"],
    ...(total !== undefined
      ? [["合计", total, "var(--color-text)"] as [string, number, string]]
      : []),
  ];
  return (
    <div
      className="flex overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--color-border)" }}
    >
      {items.map(([label, val, color], i) => (
        <div
          key={label}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3"
          style={{
            background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-1)",
            borderLeft: i > 0 ? "1px solid var(--color-border)" : undefined,
          }}
        >
          <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>
            {label}
          </span>
          <span className="text-xl font-bold tabular-nums" style={{ color }}>
            {val}
          </span>
        </div>
      ))}
    </div>
  );
}

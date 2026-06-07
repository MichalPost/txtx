import type { DownloadStats } from "@/types";

export function TaskStats({ stats }: { stats: DownloadStats }) {
  const items: [string, number, string][] = [
    ["收集", stats.total_collected, "var(--color-text-muted)"],
    ["黑名单", stats.blacklist_filtered, "var(--color-warning)"],
    ["已存在", stats.local_exists, "var(--color-text-muted)"],
    ["待下载", stats.final_download, "var(--color-accent)"],
  ];
  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--color-border)" }}
    >
      {items.map(([label, val, color], i) => (
        <div
          key={label}
          className="flex items-center justify-between px-4 py-2.5"
          style={{
            background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-1)",
            borderTop: i > 0 ? "1px solid var(--color-border)" : undefined,
          }}
        >
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {label}
          </span>
          <span className="text-sm font-semibold tabular-nums" style={{ color }}>
            {val}
          </span>
        </div>
      ))}
    </div>
  );
}

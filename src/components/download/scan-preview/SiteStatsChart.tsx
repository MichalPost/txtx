import { useMemo } from "react";

import { BarChart2 } from "lucide-react";

import type { ScanItem } from "@/types";

export function SiteStatsChart({ items }: { items: ScanItem[] }) {
  const siteStats = useMemo(() => {
    const map: Record<string, { pending: number; excluded: number }> = {};
    items.forEach((i) => {
      const key = i.site.replace(/^https?:\/\//, "");
      if (!map[key]) map[key] = { pending: 0, excluded: 0 };
      if (i.excluded_reason) map[key].excluded++;
      else map[key].pending++;
    });
    return Object.entries(map)
      .map(([site, counts]) => ({ site, ...counts, total: counts.pending + counts.excluded }))
      .sort((a, b) => b.total - a.total);
  }, [items]);

  const maxTotal = Math.max(...siteStats.map((s) => s.total), 1);

  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl border px-4 py-3"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <BarChart2 className="h-3.5 w-3.5" style={{ color: "var(--color-accent)" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
          各站点分布
        </span>
        <div
          className="ml-auto flex items-center gap-3 text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ background: "var(--color-accent)" }}
            />
            待下载
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ background: "var(--color-border)" }}
            />
            已排除
          </span>
        </div>
      </div>
      {siteStats.map(({ site, pending, excluded, total }) => (
        <div key={site} className="flex items-center gap-2">
          <span
            className="w-28 shrink-0 truncate text-xs"
            style={{ color: "var(--color-text-muted)" }}
            title={site}
          >
            {site}
          </span>
          <div
            className="flex h-4 flex-1 overflow-hidden rounded-full"
            style={{ background: "var(--color-surface-1)" }}
          >
            <div
              className="h-full rounded-l-full transition-all duration-500"
              style={{
                width: `${(pending / maxTotal) * 100}%`,
                background: "var(--color-accent)",
                minWidth: pending > 0 ? 4 : 0,
              }}
            />
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${(excluded / maxTotal) * 100}%`,
                background: "color-mix(in srgb, var(--color-text-muted) 30%, transparent)",
                minWidth: excluded > 0 ? 4 : 0,
              }}
            />
          </div>
          <span
            className="w-8 shrink-0 text-right text-xs font-medium tabular-nums"
            style={{ color: "var(--color-text)" }}
          >
            {total}
          </span>
        </div>
      ))}
    </div>
  );
}

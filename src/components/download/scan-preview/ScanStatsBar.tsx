import { lazy, Suspense } from "react";
import { BarChart2 } from "lucide-react";

import type { ScanItem } from "@/types";

const LazySiteStatsChart = lazy(async () => {
  const module = await import("./SiteStatsChart");
  return { default: module.SiteStatsChart };
});

export function ScanStatsBar({
  scanStats,
  scanItems,
  showChart,
  onToggleChart,
}: {
  scanStats?: {
    total_collected: number;
    after_dedup: number;
    blacklist_filtered: number;
    local_exists: number;
    final_download: number;
  } | null;
  scanItems: ScanItem[];
  showChart: boolean;
  onToggleChart: () => void;
}) {
  return (
    <>
      {scanStats && (
        <div className="flex min-w-0 shrink-0 flex-wrap gap-2">
          {(
            [
              ["收集", scanStats.total_collected, "var(--color-text-muted)"],
              ["去重后", scanStats.after_dedup, "var(--color-text-muted)"],
              ["黑名单", scanStats.blacklist_filtered, "var(--color-warning)"],
              ["已存在", scanStats.local_exists, "var(--color-text-muted)"],
              ["待下载", scanStats.final_download, "var(--color-accent)"],
            ] as [string, number, string][]
          ).map(([label, val, color]) => (
            <div
              key={label}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
              <span className="font-semibold tabular-nums" style={{ color }}>
                {val}
              </span>
            </div>
          ))}
          <button
            onClick={onToggleChart}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
            style={{
              background: showChart
                ? "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))"
                : "var(--color-surface)",
              borderColor: showChart ? "var(--color-accent)" : "var(--color-border)",
              color: showChart ? "var(--color-accent)" : "var(--color-text-muted)",
            }}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            分布图
          </button>
        </div>
      )}

      {showChart && (
        <div className="shrink-0">
          <Suspense
            fallback={
              <div
                className="rounded-xl border px-4 py-3 text-xs"
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
                正在加载分布图...
              </div>
            }
          >
            <LazySiteStatsChart items={scanItems} />
          </Suspense>
        </div>
      )}
    </>
  );
}

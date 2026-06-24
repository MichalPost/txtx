import { Suspense, lazy } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/Button";
import { useHistoryStats } from "./useHistoryStats";

const DailyTrendChart = lazy(() =>
  import("./DailyTrendChart").then((module) => ({ default: module.DailyTrendChart })),
);
const SiteDistributionChart = lazy(() =>
  import("./SiteDistributionChart").then((module) => ({ default: module.SiteDistributionChart })),
);

interface HistoryStatsPanelProps {
  onClose: () => void;
}

export function HistoryStatsPanel({ onClose }: HistoryStatsPanelProps) {
  const { isLoading, error, refetch, isFetching, daily, sites, containerRef } = useHistoryStats(30);

  if (isLoading) {
    return <StatsSkeleton />;
  }

  if (error) {
    return (
      <div
        className="mb-4 flex flex-col items-center justify-center gap-3 rounded-xl border px-4 py-10 text-center"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <AlertCircle className="h-8 w-8" style={{ color: "var(--color-danger)" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            统计面板加载失败
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            你可以重试一次，或先查看下方历史列表。
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void refetch()}>
          重试加载
        </Button>
      </div>
    );
  }

  if (daily.length === 0 && sites.length === 0) {
    return (
      <div
        className="mb-4 flex flex-col items-center justify-center gap-3 rounded-xl border px-4 py-10 text-center"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          还没有可统计的历史数据
        </p>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          等下载记录积累后，这里会显示趋势和站点分布。
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<StatsSkeleton />}>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {isFetching ? "统计数据刷新中..." : "统计数据已同步"}
          </div>
          <Button size="sm" variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "刷新中..." : "刷新统计"}
          </Button>
        </div>
        <div
          ref={containerRef}
          className="grid grid-cols-1 gap-4 xl:grid-cols-2"
          style={{ opacity: 0 }}
        >
          <DailyTrendChart data={daily} onClose={onClose} />
          <SiteDistributionChart data={sites} />
        </div>
      </div>
    </Suspense>
  );
}

function StatsSkeleton() {
  return (
    <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-48 animate-pulse rounded-xl border"
          style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}
        />
      ))}
    </div>
  );
}

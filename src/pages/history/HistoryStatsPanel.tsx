import { DailyTrendChart } from "./DailyTrendChart";
import { SiteDistributionChart } from "./SiteDistributionChart";
import { useHistoryStats } from "./useHistoryStats";

interface HistoryStatsPanelProps {
  onClose: () => void;
}

export function HistoryStatsPanel({ onClose }: HistoryStatsPanelProps) {
  const { isLoading, daily, sites, containerRef } = useHistoryStats(30);

  if (isLoading) {
    return (
      <div className="mb-4 grid grid-cols-2 gap-4">
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

  return (
    <div ref={containerRef} className="mb-4 grid grid-cols-2 gap-4" style={{ opacity: 0 }}>
      <DailyTrendChart data={daily} onClose={onClose} />
      <SiteDistributionChart data={sites} />
    </div>
  );
}

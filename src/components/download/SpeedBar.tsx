import { Gauge, Timer } from "lucide-react";

import { AnimatedProgressBar } from "@/components/AnimatedProgressBar";
import { useDownloadStore } from "@/store/downloadStore";

function formatEta(seconds: number): string {
  if (seconds < 0) return "—";
  if (seconds < 60) return `${seconds}秒`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}分${s}秒` : `${m}分钟`;
}

export function SpeedBar() {
  const { speed, overallTotal, overallCompleted } = useDownloadStore();
  const { chaptersPerSecond, etaSeconds } = speed;
  if (overallTotal === 0) return null;

  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-4 py-2.5"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Gauge className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span style={{ color: "var(--color-text-muted)" }}>总体进度</span>
          <span className="font-medium tabular-nums" style={{ color: "var(--color-text)" }}>
            {overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0}%
          </span>
        </div>
        <AnimatedProgressBar value={overallCompleted} total={overallTotal} />
      </div>
      <div className="ml-2 flex shrink-0 flex-col items-end gap-0.5">
        {chaptersPerSecond > 0 && (
          <span
            className="text-xs font-medium tabular-nums"
            style={{ color: "var(--color-accent)" }}
          >
            {chaptersPerSecond.toFixed(1)} 章/秒
          </span>
        )}
        <div
          className="flex items-center gap-1 text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          <Timer className="h-3 w-3" />
          <span className="tabular-nums">{formatEta(etaSeconds)}</span>
        </div>
      </div>
    </div>
  );
}

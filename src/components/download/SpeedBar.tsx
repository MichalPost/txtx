import { Gauge, Timer } from "lucide-react";
import { useDownloadStore } from "@/store/downloadStore";
import { AnimatedProgressBar } from "@/components/AnimatedProgressBar";

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
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl border"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Gauge className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span style={{ color: "var(--color-text-muted)" }}>总体进度</span>
          <span className="tabular-nums font-medium" style={{ color: "var(--color-text)" }}>
            {overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0}%
          </span>
        </div>
        <AnimatedProgressBar value={overallCompleted} total={overallTotal} />
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0 ml-2">
        {chaptersPerSecond > 0 && (
          <span className="text-xs tabular-nums font-medium" style={{ color: "var(--color-accent)" }}>
            {chaptersPerSecond.toFixed(1)} 章/秒
          </span>
        )}
        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          <Timer className="w-3 h-3" />
          <span className="tabular-nums">{formatEta(etaSeconds)}</span>
        </div>
      </div>
    </div>
  );
}

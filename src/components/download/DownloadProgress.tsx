import { useEffect, useRef } from "react";
import { CheckCircle, AlertCircle, Loader2, Zap } from "lucide-react";
import { useDownloadStore } from "@/store/downloadStore";
import { AnimatedProgressBar } from "@/components/AnimatedProgressBar";
import { SpeedBar } from "@/components/download/SpeedBar";
import { DownloadResultSummary } from "@/components/download/DownloadResultSummary";
import { animateCountUp } from "@/lib/animations";

// ─── Animated stat cell ───────────────────────────────────────────────────────

function StatCell({ label, value, color }: { label: string; value: number; color: string }) {
  const numRef = useRef<HTMLSpanElement>(null);
  const prevVal = useRef<number | null>(null);

  useEffect(() => {
    if (!numRef.current) return;
    const prev = prevVal.current;
    prevVal.current = value;
    if (prev === null) {
      // First render — count up from 0
      animateCountUp(numRef.current, 0, value, 600);
    } else if (prev !== value) {
      animateCountUp(numRef.current, prev, value, 400);
    }
  }, [value]);

  return (
    <div
      className="flex flex-col gap-0.5 px-3 py-2 rounded-lg border"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span ref={numRef} className="text-lg font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

export function DownloadProgress() {
  const { siteProgress, novelProgress, novelResults, stats, phase, speed } = useDownloadStore();
  const sites = Object.values(siteProgress);
  const novels = Object.values(novelProgress);

  if (phase === "done") return <DownloadResultSummary />;

  return (
    <div className="flex flex-col gap-3 overflow-y-auto">
      <SpeedBar />

      {stats && (
        <div className="grid grid-cols-2 gap-2">
          {([
            ["收集", stats.total_collected, "var(--color-text-muted)"],
            ["黑名单", stats.blacklist_filtered, "var(--color-warning)"],
            ["已存在", stats.local_exists, "var(--color-text-muted)"],
            ["待下载", stats.final_download, "var(--color-accent)"],
          ] as [string, number, string][]).map(([label, val, color]) => (
            <StatCell key={label} label={label} value={val} color={color} />
          ))}
        </div>
      )}

      {novels.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-surface)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            className="px-4 py-2.5 border-b flex items-center gap-1.5"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
          >
            <Zap className="w-3.5 h-3.5" style={{ color: "var(--color-accent)" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>正在下载</span>
            {speed.chaptersPerSecond > 0 && (
              <span className="ml-auto text-xs tabular-nums" style={{ color: "var(--color-accent)" }}>
                {speed.chaptersPerSecond.toFixed(1)} 章/秒
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3 p-4">
            {novels.map((n) => (
              <div key={n.name}>
                <p className="text-xs truncate mb-1.5 font-medium" style={{ color: "var(--color-text)" }}>
                  {n.name}
                </p>
                <AnimatedProgressBar value={n.current} total={n.total} />
              </div>
            ))}
          </div>
        </div>
      )}

      {sites.length > 0 && (
        <div className="flex flex-col gap-2">
          {sites.map((s) => (
            <div
              key={s.domain}
              className="px-4 py-3 rounded-xl border"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                {s.status === "downloading" ? (
                  <Loader2 className="w-3 h-3 animate-spin" style={{ color: "var(--color-accent)" }} />
                ) : s.status === "done" ? (
                  <CheckCircle className="w-3 h-3" style={{ color: "var(--color-success)" }} />
                ) : (
                  <AlertCircle className="w-3 h-3" style={{ color: "var(--color-danger)" }} />
                )}
                <span className="text-xs truncate font-medium" style={{ color: "var(--color-text)" }}>
                  {s.domain.replace(/^https?:\/\//, "")}
                </span>
                <span className="ml-auto text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                  {s.completed}/{s.total}
                </span>
              </div>
              <AnimatedProgressBar value={s.completed} total={s.total} />
            </div>
          ))}
        </div>
      )}

      {novelResults.length > 0 && (
        <div
          className="flex items-center gap-3 text-xs px-3 py-2 rounded-lg"
          style={{ background: "var(--color-surface-2)" }}
        >
          <span style={{ color: "var(--color-success)" }}>
            ✓ {novelResults.filter((r) => r.status === "success").length}
          </span>
          {novelResults.filter((r) => r.status === "error").length > 0 && (
            <span style={{ color: "var(--color-danger)" }}>
              ✗ {novelResults.filter((r) => r.status === "error").length}
            </span>
          )}
          <span style={{ color: "var(--color-text-muted)" }}>已完成</span>
        </div>
      )}
    </div>
  );
}

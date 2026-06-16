import { useCallback, useState } from "react";
import { Activity, Loader2, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { apiCheckSites } from "@/lib/api";
import type { SiteHealth } from "@/types";

interface SiteHealthCheckerProps {
  onHealthMap: (map: Record<string, SiteHealth>) => void;
}

export function SiteHealthChecker({ onHealthMap }: SiteHealthCheckerProps) {
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<SiteHealth[]>([]);
  const [checked, setChecked] = useState(false);

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const data = await apiCheckSites();
      setResults(data);
      setChecked(true);
      const map: Record<string, SiteHealth> = {};
      data.forEach((r) => {
        map[r.domain] = r;
      });
      onHealthMap(map);
    } catch (error) {
      toast.error(`站点检查失败：${String(error)}`);
    } finally {
      setChecking(false);
    }
  }, [onHealthMap]);

  const unreachable = results.filter((r) => !r.reachable);

  if (!checked) {
    return (
      <button
        onClick={runCheck}
        disabled={checking}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
        style={{
          background: "var(--color-surface-1)",
          borderColor: "var(--color-border)",
          color: "var(--color-text-muted)",
        }}
      >
        {checking ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Activity className="h-3.5 w-3.5" />
        )}
        {checking ? "检查中..." : "检查站点"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {unreachable.length === 0 ? (
        <span
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
          style={{
            background: "color-mix(in srgb, var(--color-success) 10%, transparent)",
            color: "var(--color-success)",
            border: "1px solid color-mix(in srgb, var(--color-success) 25%, transparent)",
          }}
        >
          <Wifi className="h-3.5 w-3.5" />
          全部 {results.length} 个站点可达
        </span>
      ) : (
        <span
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
          style={{
            background: "color-mix(in srgb, var(--color-warning) 10%, transparent)",
            color: "var(--color-warning)",
            border: "1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)",
          }}
          title={unreachable.map((r) => r.domain).join(", ")}
        >
          <WifiOff className="h-3.5 w-3.5" />
          {unreachable.length} 个站点不可达
        </span>
      )}
      <button
        onClick={runCheck}
        disabled={checking}
        className="text-xs"
        style={{ color: "var(--color-text-subtle)" }}
      >
        {checking ? <Loader2 className="inline h-3 w-3 animate-spin" /> : "重检"}
      </button>
    </div>
  );
}

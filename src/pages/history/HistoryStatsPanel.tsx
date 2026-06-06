import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

import { Card } from "@/components/Card";
import { animateFadeInUp } from "@/lib/animations";
import { apiGetHistoryStats } from "@/lib/api";

const PIE_COLORS = [
  "var(--color-accent)",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

interface HistoryStatsPanelProps {
  onClose: () => void;
}

export function HistoryStatsPanel({ onClose }: HistoryStatsPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["history-stats", 30],
    queryFn: () => apiGetHistoryStats(30),
  });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && containerRef.current) {
      animateFadeInUp(containerRef.current, 0);
    }
  }, [isLoading]);

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

  const daily = data?.daily ?? [];
  const sites = (data?.sites ?? []).map((s, i) => ({
    ...s,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }));

  return (
    <div ref={containerRef} className="mb-4 grid grid-cols-2 gap-4" style={{ opacity: 0 }}>
      <Card
        title="近 30 天下载趋势"
        actions={
          <button
            onClick={onClose}
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            收起
          </button>
        }
      >
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                tickFormatter={(d) => d.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: ValueType | undefined, name: NameType | undefined) => [
                  v ?? 0,
                  name === "success" ? "成功" : "失败",
                ] as [ValueType, NameType]}
              />
              <Bar
                dataKey="success"
                fill="var(--color-success)"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
              />
              <Bar
                dataKey="error"
                fill="var(--color-danger)"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="站点分布（成功）">
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sites}
                dataKey="count"
                nameKey="site"
                cx="40%"
                cy="50%"
                outerRadius={60}
                fontSize={10}
              />
              <Legend
                formatter={(v: string) => v.replace(/^https?:\/\//, "").slice(0, 12)}
                wrapperStyle={{ fontSize: 10, color: "var(--color-text-muted)" }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: ValueType | undefined, name: NameType | undefined) => [
                  v ?? 0,
                  String(name ?? "").replace(/^https?:\/\//, ""),
                ] as [ValueType, NameType]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

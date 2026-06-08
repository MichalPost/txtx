import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

import { Card } from "@/components/Card";

interface DailyEntry {
  date: string;
  success: number;
  error: number;
}

interface DailyTrendChartProps {
  data: DailyEntry[];
  onClose: () => void;
}

const TOOLTIP_STYLE = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

function formatDailyTooltip(v: ValueType | undefined, name: NameType | undefined) {
  return [v ?? 0, name === "success" ? "成功" : "失败"] as [ValueType, NameType];
}

export function DailyTrendChart({ data, onClose }: DailyTrendChartProps) {
  return (
    <Card
      title="近 30 天下载趋势"
      actions={
        <button onClick={onClose} className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          收起
        </button>
      }
    >
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
              tickFormatter={(d) => d.slice(5)}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={formatDailyTooltip} />
            <Bar
              dataKey="success"
              fill="var(--color-success)"
              radius={[3, 3, 0, 0]}
              maxBarSize={20}
            />
            <Bar dataKey="error" fill="var(--color-danger)" radius={[3, 3, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

import { Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

import { Card } from "@/components/Card";

interface SiteEntry {
  site: string;
  count: number;
  fill: string;
}

interface SiteDistributionChartProps {
  data: SiteEntry[];
}

const TOOLTIP_STYLE = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

function stripProtocol(url: string) {
  return url.replace(/^https?:\/\//, "");
}

function formatSiteTooltip(v: ValueType | undefined, name: NameType | undefined) {
  return [v ?? 0, stripProtocol(String(name ?? ""))] as [ValueType, NameType];
}

export function SiteDistributionChart({ data }: SiteDistributionChartProps) {
  return (
    <Card title="站点分布（成功）">
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="site"
              cx="40%"
              cy="50%"
              outerRadius={60}
              fontSize={10}
            />
            <Legend
              formatter={(v: string) => stripProtocol(v).slice(0, 12)}
              wrapperStyle={{ fontSize: 10, color: "var(--color-text-muted)" }}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={formatSiteTooltip} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

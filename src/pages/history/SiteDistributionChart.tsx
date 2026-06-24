import { Card } from "@/components/Card";

interface SiteEntry {
  site: string;
  count: number;
  fill: string;
}

interface SiteDistributionChartProps {
  data: SiteEntry[];
}

function stripProtocol(url: string) {
  return url.replace(/^https?:\/\//, "");
}

export function SiteDistributionChart({ data }: SiteDistributionChartProps) {
  const total = data.reduce((sum, entry) => sum + entry.count, 0) || 1;

  return (
    <Card title="站点分布（成功）">
      <div className="flex flex-col gap-3">
        <div
          className="flex h-4 overflow-hidden rounded-full"
          style={{ background: "var(--color-surface-2)" }}
          aria-label="站点分布"
        >
          {data.map((entry) => (
            <div
              key={entry.site}
              style={{
                width: `${(entry.count / total) * 100}%`,
                background: entry.fill,
                minWidth: entry.count > 0 ? 6 : 0,
              }}
              title={`${stripProtocol(entry.site)}：${entry.count}`}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {data.map((entry) => (
            <div
              key={entry.site}
              className="flex items-center gap-2 rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: entry.fill }}
              />
              <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--color-text)" }}>
                {stripProtocol(entry.site)}
              </span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                {entry.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

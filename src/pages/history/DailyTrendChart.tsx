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

function formatLabel(date: string) {
  return date.slice(5);
}

export function DailyTrendChart({ data, onClose }: DailyTrendChartProps) {
  const maxValue = Math.max(1, ...data.flatMap((entry) => [entry.success, entry.error]));

  return (
    <Card
      title="近 30 天下载趋势"
      actions={
        <button type="button" onClick={onClose} className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          收起
        </button>
      }
    >
      <div className="flex h-40 items-end gap-2 overflow-hidden">
        {data.map((entry) => {
          const successHeight = `${(entry.success / maxValue) * 100}%`;
          const errorHeight = `${(entry.error / maxValue) * 100}%`;

          return (
            <div key={entry.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-28 w-full items-end justify-center gap-1 rounded-xl bg-[var(--color-surface-2)] px-1 py-2">
                <div
                  className="w-2.5 rounded-full"
                  style={{
                    height: successHeight,
                    minHeight: entry.success > 0 ? 6 : 0,
                    background: "var(--color-success)",
                  }}
                  title={`${formatLabel(entry.date)} 成功 ${entry.success}`}
                />
                <div
                  className="w-2.5 rounded-full"
                  style={{
                    height: errorHeight,
                    minHeight: entry.error > 0 ? 6 : 0,
                    background: "var(--color-danger)",
                  }}
                  title={`${formatLabel(entry.date)} 失败 ${entry.error}`}
                />
              </div>
              <span className="truncate text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                {formatLabel(entry.date)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-success)" }} />
          成功
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-danger)" }} />
          失败
        </span>
      </div>
    </Card>
  );
}

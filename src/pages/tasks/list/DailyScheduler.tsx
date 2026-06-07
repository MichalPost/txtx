import { Clock } from "lucide-react";

interface DailySchedulerProps {
  enabled: boolean;
  hour: number;
  onToggle: () => void;
  onSetHour: (h: number) => void;
}

export function DailyScheduler({ enabled, hour, onToggle, onSetHour }: DailySchedulerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock
            className="h-3.5 w-3.5"
            style={{
              color: enabled ? "var(--color-accent)" : "var(--color-text-muted)",
            }}
          />
          <span className="text-[10px] font-medium" style={{ color: "var(--color-text-muted)" }}>
            每日自动扫描
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="relative h-4 w-8 rounded-full transition-colors"
          style={{
            background: enabled ? "var(--color-accent)" : "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
          }}
        >
          <span
            className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all"
            style={{ left: enabled ? "calc(100% - 14px)" : "2px" }}
          />
        </button>
      </div>
      {enabled && (
        <div className="flex items-center gap-2 pl-5">
          <span className="text-[10px]" style={{ color: "var(--color-text-subtle)" }}>
            触发时间
          </span>
          <select
            value={hour}
            onChange={(e) => onSetHour(Number(e.target.value))}
            className="rounded border px-1.5 py-0.5 text-xs"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {String(i).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

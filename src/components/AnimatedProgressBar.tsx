import { useEffect, useRef } from "react";

interface AnimatedProgressBarProps {
  value: number;
  total: number;
  color?: string;
}

export function AnimatedProgressBar({ value, total, color }: AnimatedProgressBarProps) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const barRef = useRef<HTMLDivElement>(null);
  const prevPct = useRef(0);

  useEffect(() => {
    if (!barRef.current) return;
    const el = barRef.current;
    const from = prevPct.current;
    prevPct.current = pct;
    if (from === 0 && pct > 0) {
      el.style.width = "0%";
      requestAnimationFrame(() => {
        el.style.transition = "width 0.6s cubic-bezier(0.4,0,0.2,1)";
        el.style.width = `${pct}%`;
      });
    } else {
      el.style.transition = "width 0.5s cubic-bezier(0.4,0,0.2,1)";
      el.style.width = `${pct}%`;
    }
  }, [pct]);

  return (
    <div className="flex items-center gap-3">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full"
        style={{ background: "var(--color-surface-2)" }}
      >
        <div
          ref={barRef}
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color ?? "var(--color-accent)" }}
        />
      </div>
      <span
        className="w-16 text-right text-xs tabular-nums"
        style={{ color: "var(--color-text-muted)" }}
      >
        {value}/{total}
      </span>
    </div>
  );
}

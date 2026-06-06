import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

import { animateDropdownOpen } from "@/lib/animations";

type DatePreset = "1" | "3" | "7" | "14" | "30" | "60" | "custom";

interface DateRangePickerProps {
  value: string | null; // YYYY-MM-DD target date (start of range)
  onChange: (date: string | null) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(() => dayjs().startOf("month"));
  const [activePreset, setActivePreset] = useState<DatePreset>("7");
  const calRef = useRef<HTMLDivElement>(null);
  const today = dayjs();

  // Sync preset from value
  useEffect(() => {
    if (!value) {
      setActivePreset("7");
      return;
    }
    const diff = today.diff(dayjs(value), "day");
    const map: Record<number, DatePreset> = {
      1: "1",
      3: "3",
      7: "7",
      14: "14",
      30: "30",
      60: "60",
    };
    setActivePreset(map[diff] ?? "custom");
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showCalendar && calRef.current) animateDropdownOpen(calRef.current);
  }, [showCalendar]);

  useEffect(() => {
    if (!showCalendar) return;
    const handler = (e: MouseEvent) => {
      if (
        calRef.current &&
        !calRef.current.closest(".date-picker-root")?.contains(e.target as Node)
      ) {
        setShowCalendar(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCalendar]);

  const presets: { key: DatePreset; label: string }[] = [
    { key: "1", label: "今天" },
    { key: "3", label: "3天" },
    { key: "7", label: "7天" },
    { key: "14", label: "14天" },
    { key: "30", label: "30天" },
    { key: "60", label: "60天" },
    { key: "custom", label: "自定义" },
  ];

  function applyPreset(key: DatePreset) {
    setActivePreset(key);
    if (key === "custom") {
      setShowCalendar(true);
      return;
    }
    const days = parseInt(key, 10);
    onChange(today.subtract(days, "day").format("YYYY-MM-DD"));
    setShowCalendar(false);
  }

  function pickDay(d: dayjs.Dayjs) {
    onChange(d.format("YYYY-MM-DD"));
    setActivePreset("custom");
    setShowCalendar(false);
  }

  const firstDay = calMonth.startOf("month");
  const startOffset = firstDay.day() === 0 ? 6 : firstDay.day() - 1;
  const daysInMonth = calMonth.daysInMonth();
  const cells: (dayjs.Dayjs | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => calMonth.date(i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedDay = value ? dayjs(value) : null;
  const displayLabel = value ? `${value} 至今 (${today.diff(dayjs(value), "day")}天)` : "不限日期";

  return (
    <div className="date-picker-root relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => applyPreset(key)}
            className="rounded-full px-3 py-1 text-xs font-medium transition-all"
            style={{
              background: activePreset === key ? "var(--color-accent)" : "var(--color-surface-1)",
              color: activePreset === key ? "#fff" : "var(--color-text-muted)",
              border: `1px solid ${activePreset === key ? "var(--color-accent)" : "var(--color-border)"}`,
              transform: activePreset === key ? "scale(1.05)" : "scale(1)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          扫描范围：
          <span className="font-medium" style={{ color: "var(--color-text)" }}>
            {displayLabel}
          </span>
        </span>
        {value && (
          <button
            className="ml-auto text-xs"
            style={{ color: "var(--color-text-subtle)" }}
            onClick={() => {
              onChange(null);
              setActivePreset("7");
            }}
          >
            清除
          </button>
        )}
      </div>

      {showCalendar && (
        <div
          ref={calRef}
          className="absolute top-full left-0 z-50 mt-2 overflow-hidden rounded-xl border shadow-xl"
          style={{
            opacity: 0,
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            width: 280,
          }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
          >
            <button
              onClick={() => setCalMonth((m) => m.subtract(1, "month"))}
              className="rounded-lg p-1 transition-opacity hover:opacity-70"
              style={{ color: "var(--color-text-muted)" }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              {calMonth.format("YYYY年M月")}
            </span>
            <button
              onClick={() => setCalMonth((m) => m.add(1, "month"))}
              className="rounded-lg p-1 transition-opacity hover:opacity-70"
              style={{ color: "var(--color-text-muted)" }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 px-3 pt-2 pb-1">
            {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
              <div
                key={d}
                className="py-1 text-center text-xs font-medium"
                style={{ color: "var(--color-text-subtle)" }}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 px-3 pb-3">
            {cells.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} />;
              const isSelected = selectedDay?.isSame(d, "day");
              const isToday = today.isSame(d, "day");
              const isFuture = d.isAfter(today, "day");
              const isInRange =
                selectedDay && d.isAfter(selectedDay, "day") && !d.isAfter(today, "day");
              return (
                <button
                  key={d.format("YYYY-MM-DD")}
                  disabled={isFuture}
                  onClick={() => pickDay(d)}
                  className="relative flex h-8 items-center justify-center rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: isSelected
                      ? "var(--color-accent)"
                      : isInRange
                        ? "color-mix(in srgb, var(--color-accent) 12%, transparent)"
                        : "transparent",
                    color: isSelected
                      ? "#fff"
                      : isFuture
                        ? "var(--color-text-subtle)"
                        : isToday
                          ? "var(--color-accent)"
                          : "var(--color-text)",
                    fontWeight: isToday ? 700 : undefined,
                    opacity: isFuture ? 0.3 : 1,
                    cursor: isFuture ? "not-allowed" : "pointer",
                  }}
                >
                  {d.date()}
                  {isToday && !isSelected && (
                    <span
                      className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                      style={{ background: "var(--color-accent)" }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="px-3 pb-3">
            <button
              onClick={() => pickDay(today)}
              className="w-full rounded-lg py-1.5 text-xs font-medium transition-colors"
              style={{
                background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                color: "var(--color-accent)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
              }}
            >
              跳到今天
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

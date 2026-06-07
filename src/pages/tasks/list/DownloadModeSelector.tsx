import { Cpu, Minus, Zap } from "lucide-react";

import type { DownloadMode } from "@/types";

const DOWNLOAD_MODES: {
  mode: DownloadMode;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    mode: "smart",
    label: "智能模式",
    desc: "优先多线程，出错时自动切回单线程",
    icon: <Zap className="h-3.5 w-3.5" />,
    color: "var(--color-accent)",
  },
  {
    mode: "multi",
    label: "多线程",
    desc: "强制多线程，出错次数达到设定值后跳过",
    icon: <Cpu className="h-3.5 w-3.5" />,
    color: "var(--color-warning)",
  },
  {
    mode: "single",
    label: "单线程",
    desc: "速度慢但稳定",
    icon: <Minus className="h-3.5 w-3.5" />,
    color: "var(--color-text-muted)",
  },
];

interface DownloadModeSelectorProps {
  value: DownloadMode;
  onChange: (m: DownloadMode) => void;
}

export function DownloadModeSelector({ value, onChange }: DownloadModeSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-0.5 text-[10px] font-medium" style={{ color: "var(--color-text-muted)" }}>
        下载方式
      </p>
      <div className="flex flex-col gap-1">
        {DOWNLOAD_MODES.map(({ mode, label, desc, icon, color }) => {
          const active = value === mode;
          return (
            <button
              key={mode}
              onClick={() => onChange(mode)}
              className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all"
              style={{
                background: active
                  ? "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))"
                  : "var(--color-surface)",
                borderColor: active
                  ? "color-mix(in srgb, var(--color-accent) 50%, transparent)"
                  : "var(--color-border)",
              }}
            >
              <span style={{ color: active ? color : "var(--color-text-muted)" }}>{icon}</span>

              <div className="min-w-0 flex-1">
                <p
                  className="mb-0.5 text-xs leading-none font-medium"
                  style={{ color: active ? "var(--color-text)" : "var(--color-text-muted)" }}
                >
                  {label}
                </p>
                <p
                  className="text-[10px] leading-tight"
                  style={{ color: "var(--color-text-subtle)" }}
                >
                  {desc}
                </p>
              </div>

              <div
                className="h-2 w-2 shrink-0 rounded-full transition-all"
                style={{
                  background: active ? color : "transparent",
                  border: `1.5px solid ${active ? color : "var(--color-border)"}`,
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

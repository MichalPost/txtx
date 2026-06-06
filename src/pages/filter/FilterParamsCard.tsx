import { SlidersHorizontal } from "lucide-react";

import { Card } from "@/components/Card";
import {
  inlineInputClass,
  inlineInputStyle,
  inputFocusHandlersSimple,
} from "@/pages/blacklist/blacklistUtils";
import type { ContentFilterConfig } from "@/types";

interface FilterParamsCardProps {
  config: ContentFilterConfig;
  onUpdate: (patch: Partial<ContentFilterConfig>) => void;
}

export function FilterParamsCard({ config, onUpdate }: FilterParamsCardProps) {
  return (
    <Card title="过滤参数">
      <div className="flex flex-col gap-4">
        {/* Safety threshold */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              安全回退阈值
            </label>
            <span
              className="rounded px-1.5 py-0.5 font-mono text-xs"
              style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
            >
              {config.safety_threshold.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.safety_threshold}
            onChange={(e) => onUpdate({ safety_threshold: parseFloat(e.target.value) })}
            className="w-full accent-[var(--color-accent)]"
          />
          <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            过滤后内容少于原文此比例时触发安全回退，避免误删太多
          </p>
        </div>

        {/* Fallback trim lines */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            回退时末尾删除行数
          </label>
          <input
            type="number"
            min={0}
            max={10}
            value={config.fallback_trim_lines}
            onChange={(e) => onUpdate({ fallback_trim_lines: parseInt(e.target.value) || 0 })}
            className={`w-full ${inlineInputClass}`}
            style={inlineInputStyle}
            {...inputFocusHandlersSimple}
          />
          <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            触发安全回退时，仍从末尾删除的固定行数
          </p>
        </div>

        {/* Stats */}
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-2"
          style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}
        >
          <SlidersHorizontal
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "var(--color-text-subtle)" }}
          />
          <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            参数调整后将在下次下载时生效
          </p>
        </div>
      </div>
    </Card>
  );
}

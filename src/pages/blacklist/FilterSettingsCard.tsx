import { Card } from "@/components/Card";
import { Toggle } from "@/components/Toggle";
import type { AppConfig } from "@/types";

import { inputFocusHandlersSimple } from "./blacklistUtils";

type Blacklist = AppConfig["blacklist"];

interface FilterSettingsCardProps {
  blacklist: Blacklist;
  onUpdate: (patch: Partial<Blacklist>) => void;
}

export function FilterSettingsCard({ blacklist: bl, onUpdate }: FilterSettingsCardProps) {
  return (
    <Card title="过滤设置">
      <div className="flex flex-col gap-4">
        <Toggle
          checked={bl.enabled}
          onChange={(value) => onUpdate({ enabled: value })}
          label="启用黑名单"
        />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            过滤级别
          </label>
          <select
            className="rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
            value={bl.filter_level}
            onChange={(e) =>
              onUpdate({ filter_level: e.target.value as Blacklist["filter_level"] })
            }
            {...inputFocusHandlersSimple}
          >
            <option value="strict">严格</option>
            <option value="moderate">中等</option>
            <option value="mild">宽松</option>
          </select>
        </div>

        <Toggle
          checked={bl.case_insensitive}
          onChange={(value) => onUpdate({ case_insensitive: value })}
          label="大小写不敏感"
        />
        <Toggle
          checked={bl.fuzzy_match}
          onChange={(value) => onUpdate({ fuzzy_match: value })}
          label="模糊匹配（包含即过滤）"
        />
        <Toggle
          checked={bl.regex_match}
          onChange={(value) => onUpdate({ regex_match: value })}
          label="启用正则匹配"
        />
        <Toggle
          checked={bl.tag_filter ?? false}
          onChange={(value) => onUpdate({ tag_filter: value })}
          label="启用标签过滤"
        />

        <div
          className="rounded-xl border px-3 py-2 text-xs"
          style={{
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          {bl.enabled
            ? `当前为${bl.filter_level === "strict" ? "严格" : bl.filter_level === "moderate" ? "中等" : "宽松"}模式`
            : "黑名单当前未启用，保存后才会对新任务生效"}
        </div>
      </div>
    </Card>
  );
}

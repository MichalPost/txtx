import { Card } from "@/components/Card";
import { Toggle } from "@/components/Toggle";
import { inputFocusHandlersSimple } from "./blacklistUtils";
import type { AppConfig } from "@/types";

type Blacklist = AppConfig["blacklist"];

interface FilterSettingsCardProps {
  blacklist: Blacklist;
  onUpdate: (patch: Partial<Blacklist>) => void;
}

export function FilterSettingsCard({ blacklist: bl, onUpdate }: FilterSettingsCardProps) {
  return (
    <Card title="过滤设置">
      <div className="flex flex-col gap-4">
        <Toggle checked={bl.enabled} onChange={v => onUpdate({ enabled: v })} label="启用黑名单" />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            过滤级别
          </label>
          <select
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
            value={bl.filter_level}
            onChange={e => onUpdate({ filter_level: e.target.value as Blacklist["filter_level"] })}
            {...inputFocusHandlersSimple}
          >
            <option value="strict">严格</option>
            <option value="moderate">中等</option>
            <option value="mild">宽松</option>
          </select>
        </div>

        <Toggle checked={bl.case_insensitive} onChange={v => onUpdate({ case_insensitive: v })} label="大小写不敏感" />
        <Toggle checked={bl.fuzzy_match} onChange={v => onUpdate({ fuzzy_match: v })} label="模糊匹配（包含即过滤）" />
        <Toggle checked={bl.regex_match} onChange={v => onUpdate({ regex_match: v })} label="启用正则匹配" />
        <Toggle checked={bl.tag_filter ?? false} onChange={v => onUpdate({ tag_filter: v })} label="启用标签过滤" />
      </div>
    </Card>
  );
}

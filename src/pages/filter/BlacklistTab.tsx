import { Save } from "lucide-react";
import { useConfigStore } from "@/store/configStore";
import { Button } from "@/components/Button";
import { KeywordPanel } from "@/pages/blacklist/KeywordPanel";
import { RegexPanel } from "@/pages/blacklist/RegexPanel";
import { TagPanel } from "@/pages/blacklist/TagPanel";
import { FilterSettingsCard } from "@/pages/blacklist/FilterSettingsCard";

export function BlacklistTab() {
  const { config, saveConfig, saving } = useConfigStore();

  if (!config) {
    return <div className="p-5 text-sm" style={{ color: "var(--color-text-muted)" }}>正在加载...</div>;
  }

  const bl = config.blacklist;

  const update = (patch: Partial<typeof bl>) => {
    useConfigStore.setState({ config: { ...config, blacklist: { ...bl, ...patch } } });
  };

  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            {bl.keywords.length} 个关键词，{bl.regex_patterns.length} 条正则，支持模糊搜索
          </p>
        </div>
        <Button size="sm" onClick={() => saveConfig(config)} disabled={saving}>
          <Save className="w-3.5 h-3.5" />
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>

      {/* Main layout */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: keywords */}
        <div className="flex flex-col flex-1 gap-3 min-h-0 min-w-0">
          <KeywordPanel keywords={bl.keywords} onUpdate={keywords => update({ keywords })} />
        </div>

        {/* Right: settings + regex + tags */}
        <div className="flex flex-col gap-3 w-64 shrink-0">
          <FilterSettingsCard blacklist={bl} onUpdate={update} />
          <RegexPanel patterns={bl.regex_patterns} onUpdate={regex_patterns => update({ regex_patterns })} />
          {bl.tag_filter && <TagPanel tags={bl.filtered_tags ?? []} onUpdate={filtered_tags => update({ filtered_tags })} />}
        </div>
      </div>
    </div>
  );
}

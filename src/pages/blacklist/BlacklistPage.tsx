import { Save } from "lucide-react";

import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { useConfigStore } from "@/store/configStore";

import { FilterSettingsCard } from "./FilterSettingsCard";
import { KeywordPanel } from "./KeywordPanel";
import { RegexPanel } from "./RegexPanel";
import { TagPanel } from "./TagPanel";

export function BlacklistPage() {
  const { config, saveConfig, saving, updateConfig } = useConfigStore();

  if (!config) {
    return (
      <div className="p-5" style={{ color: "var(--color-text-muted)" }}>
        正在加载...
      </div>
    );
  }

  const bl = config.blacklist;

  const update = (patch: Partial<typeof bl>) => {
    // Use updateConfig with a functional updater to avoid stale-closure race conditions
    updateConfig((c) => ({ ...c, blacklist: { ...c.blacklist, ...patch } }));
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-5">
      <PageHeader
        title="黑名单管理"
        subtitle={`共 ${bl.keywords.length} 个关键词，${bl.regex_patterns.length} 个正则，支持模糊搜索`}
        actions={
          <Button
            size="sm"
            onClick={() => saveConfig(useConfigStore.getState().config!)}
            disabled={saving}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "保存中..." : "保存"}
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Left: keywords */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <KeywordPanel keywords={bl.keywords} onUpdate={(keywords) => update({ keywords })} />
        </div>

        {/* Right: settings + regex + tags */}
        <div className="flex w-64 shrink-0 flex-col gap-3">
          <FilterSettingsCard blacklist={bl} onUpdate={update} />
          <RegexPanel
            patterns={bl.regex_patterns}
            onUpdate={(regex_patterns) => update({ regex_patterns })}
          />
          {bl.tag_filter && (
            <TagPanel
              tags={bl.filtered_tags ?? []}
              onUpdate={(filtered_tags) => update({ filtered_tags })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

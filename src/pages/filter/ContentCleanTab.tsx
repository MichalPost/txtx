import { Save } from "lucide-react";
import { useConfigStore } from "@/store/configStore";
import { Button } from "@/components/Button";
import { AdPatternPanel } from "./AdPatternPanel";
import { NavKeywordPanel } from "./NavKeywordPanel";
import { FilterParamsCard } from "./FilterParamsCard";
import { ContentCleanTestPanel } from "./ContentCleanTestPanel";
import type { ContentFilterConfig } from "@/types";

export function ContentCleanTab() {
  const { config, saveConfig, saving } = useConfigStore();

  if (!config) {
    return <div className="p-5 text-sm" style={{ color: "var(--color-text-muted)" }}>正在加载...</div>;
  }

  const cf = config.content_filter ?? {
    ad_patterns: [],
    nav_keywords: [],
    safety_threshold: 0.3,
    fallback_trim_lines: 2,
  };

  const update = (patch: Partial<ContentFilterConfig>) => {
    useConfigStore.setState({
      config: {
        ...config,
        content_filter: { ...cf, ...patch },
      },
    });
  };

  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            {cf.ad_patterns.length} 条广告规则，{cf.nav_keywords.length} 个导航词
          </p>
        </div>
        <Button size="sm" onClick={() => saveConfig(config)} disabled={saving}>
          <Save className="w-3.5 h-3.5" />
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>

      {/* Main layout */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: ad patterns (tall, scrollable) */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          <AdPatternPanel
            patterns={cf.ad_patterns}
            onUpdate={ad_patterns => update({ ad_patterns })}
          />
        </div>

        {/* Right: nav keywords + params + test */}
        <div className="flex flex-col gap-3 w-72 shrink-0 overflow-y-auto">
          <NavKeywordPanel
            keywords={cf.nav_keywords}
            onUpdate={nav_keywords => update({ nav_keywords })}
          />
          <FilterParamsCard config={cf} onUpdate={update} />
          <ContentCleanTestPanel config={cf} />
        </div>
      </div>
    </div>
  );
}

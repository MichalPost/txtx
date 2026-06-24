import { useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { useConfigStore } from "@/store/configStore";

import { buildBlacklistSummary, serializeBlacklistDraft } from "./blacklistEditorUtils";
import { FilterSettingsCard } from "./FilterSettingsCard";
import { KeywordPanel } from "./KeywordPanel";
import { RegexPanel } from "./RegexPanel";
import { TagPanel } from "./TagPanel";

export function BlacklistPage() {
  const { config, saveConfig, saving, updateConfig } = useConfigStore();
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null);

  const isDirty = config
    ? (lastSavedSnapshot ?? serializeBlacklistDraft(config.blacklist)) !==
      serializeBlacklistDraft(config.blacklist)
    : false;

  const statusTone = (() => {
    if (saving) {
      return {
        icon: <Clock3 className="h-4 w-4" />,
        text: "正在保存更改...",
        color: "var(--color-accent)",
        background: "var(--color-accent-muted)",
      };
    }

    if (isDirty) {
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        text: "有未保存改动，离开页面前记得保存",
        color: "var(--color-warning)",
        background: "rgba(217, 119, 6, 0.12)",
      };
    }

    return {
      icon: <CheckCircle2 className="h-4 w-4" />,
      text: "当前改动已同步到本地配置状态",
      color: "var(--color-success)",
      background: "rgba(22, 163, 74, 0.12)",
    };
  })();

  if (!config) {
    return (
      <div className="p-5" style={{ color: "var(--color-text-muted)" }}>
        正在加载...
      </div>
    );
  }

  const bl = config.blacklist;
  const summary = buildBlacklistSummary(bl);

  const update = (patch: Partial<typeof bl>) => {
    updateConfig((value) => ({ ...value, blacklist: { ...value.blacklist, ...patch } }));
  };

  const handleSave = async () => {
    try {
      const nextConfig = useConfigStore.getState().config!;
      await saveConfig(nextConfig, true);
      setLastSavedSnapshot(serializeBlacklistDraft(nextConfig.blacklist));
      toast.success("黑名单配置已保存");
    } catch {
      // saveConfig already reports the error toast
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-5">
      <PageHeader
        title="黑名单管理"
        subtitle={`共 ${summary.keywordCount} 个关键词，${summary.regexCount} 个正则，${summary.tagCount} 个标签过滤项`}
        actions={
          <Button size="sm" onClick={() => void handleSave()} disabled={saving || !isDirty}>
            <Save className="h-3.5 w-3.5" />
            {saving ? "保存中..." : "保存"}
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <Card inset className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                使用摘要
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                关键词优先覆盖常见噪音词，正则适合精确模式，标签过滤适合站点自带分类。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className="rounded-full px-2.5 py-1"
                style={{ background: "var(--color-surface)", color: "var(--color-text-muted)" }}
              >
                已启用 {summary.enabledFeatureCount} 项能力
              </span>
              <span
                className="rounded-full px-2.5 py-1"
                style={{ background: statusTone.background, color: statusTone.color }}
              >
                {statusTone.text}
              </span>
            </div>
          </div>
        </Card>

        <div
          className="flex items-center gap-2 rounded-[14px] border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--color-border)",
            background: statusTone.background,
            color: statusTone.color,
          }}
        >
          {statusTone.icon}
          <span>{statusTone.text}</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <KeywordPanel keywords={bl.keywords} onUpdate={(keywords) => update({ keywords })} />
        </div>

        <div className="flex min-w-0 shrink-0 flex-col gap-3 xl:w-[320px]">
          <FilterSettingsCard blacklist={bl} onUpdate={update} />
          <RegexPanel
            patterns={bl.regex_patterns}
            onUpdate={(regex_patterns) => update({ regex_patterns })}
          />
          {bl.tag_filter ? (
            <TagPanel
              tags={bl.filtered_tags ?? []}
              onUpdate={(filtered_tags) => update({ filtered_tags })}
            />
          ) : (
            <Card inset>
              <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                标签过滤当前未启用。开启后可以额外按站点标签拦截内容，例如“广告”“番外”“机器翻译”。
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

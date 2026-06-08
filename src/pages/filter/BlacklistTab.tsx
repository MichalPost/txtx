import { useRef } from "react";
import { Download, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { FilterSettingsCard } from "@/pages/blacklist/FilterSettingsCard";
import { KeywordPanel } from "@/pages/blacklist/KeywordPanel";
import { RegexPanel } from "@/pages/blacklist/RegexPanel";
import { TagPanel } from "@/pages/blacklist/TagPanel";
import { useConfigStore } from "@/store/configStore";
import type { BlacklistConfig } from "@/types";

import { BlacklistTestPanel } from "./BlacklistTestPanel";
import { WhitelistPanel } from "./WhitelistPanel";

export function BlacklistTab() {
  const { config, saveConfig, saving } = useConfigStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!config) {
    return (
      <div className="p-5 text-sm" style={{ color: "var(--color-text-muted)" }}>
        正在加载...
      </div>
    );
  }

  const bl = config.blacklist;

  const update = (patch: Partial<typeof bl>) => {
    useConfigStore.setState({ config: { ...config, blacklist: { ...bl, ...patch } } });
  };

  const handleExport = () => {
    const data: Partial<BlacklistConfig> = {
      keywords: bl.keywords,
      regex_patterns: bl.regex_patterns,
      whitelist: bl.whitelist ?? [],
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "blacklist-export.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("黑名单已导出");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as Partial<BlacklistConfig>;
        const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
        const regex_patterns = Array.isArray(parsed.regex_patterns) ? parsed.regex_patterns : [];
        const whitelist = Array.isArray(parsed.whitelist) ? parsed.whitelist : [];
        const merged = {
          keywords: [...new Set([...bl.keywords, ...keywords])],
          regex_patterns: [...new Set([...bl.regex_patterns, ...regex_patterns])],
          whitelist: [...new Set([...(bl.whitelist ?? []), ...whitelist])],
        };
        update(merged);
        toast.success(
          `已导入：${keywords.length} 个关键词，${regex_patterns.length} 条正则，${whitelist.length} 个白名单`,
        );
      } catch {
        toast.error("文件格式不正确，无法导入");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Header row */}
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            {bl.keywords.length} 个关键词，{bl.regex_patterns.length} 条正则，支持模糊搜索
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:opacity-80"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
              background: "transparent",
            }}
          >
            <Upload className="h-3 w-3" /> 导入
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:opacity-80"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
              background: "transparent",
            }}
          >
            <Download className="h-3 w-3" /> 导出
          </button>
          <Button size="sm" onClick={() => saveConfig(config)} disabled={saving}>
            <Save className="h-3.5 w-3.5" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Left: keywords */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <KeywordPanel keywords={bl.keywords} onUpdate={(keywords) => update({ keywords })} />
          <WhitelistPanel
            whitelist={bl.whitelist ?? []}
            onUpdate={(whitelist) => update({ whitelist })}
          />
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
          <BlacklistTestPanel blacklist={bl} />
        </div>
      </div>
    </div>
  );
}

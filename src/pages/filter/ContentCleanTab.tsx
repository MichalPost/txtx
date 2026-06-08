import { useRef } from "react";
import { Download, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { useConfigStore } from "@/store/configStore";
import type { ContentFilterConfig } from "@/types";

import { AdPatternPanel } from "./AdPatternPanel";
import { ContentCleanTestPanel } from "./ContentCleanTestPanel";
import { FilterParamsCard } from "./FilterParamsCard";
import { NavKeywordPanel } from "./NavKeywordPanel";

export function ContentCleanTab() {
  const { config, saveConfig, saving } = useConfigStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!config) {
    return (
      <div className="p-5 text-sm" style={{ color: "var(--color-text-muted)" }}>
        正在加载...
      </div>
    );
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

  const handleExport = () => {
    const data = { ad_patterns: cf.ad_patterns, nav_keywords: cf.nav_keywords };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "content-filter-export.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("内容清洗规则已导出");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as {
          ad_patterns?: string[];
          nav_keywords?: string[];
        };
        const ad_patterns = Array.isArray(parsed.ad_patterns) ? parsed.ad_patterns : [];
        const nav_keywords = Array.isArray(parsed.nav_keywords) ? parsed.nav_keywords : [];
        update({
          ad_patterns: [...new Set([...cf.ad_patterns, ...ad_patterns])],
          nav_keywords: [...new Set([...cf.nav_keywords, ...nav_keywords])],
        });
        toast.success(`已导入：${ad_patterns.length} 条广告规则，${nav_keywords.length} 个导航词`);
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
            {cf.ad_patterns.length} 条广告规则，{cf.nav_keywords.length} 个导航词
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
        {/* Left: ad patterns (tall, scrollable) */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AdPatternPanel
            patterns={cf.ad_patterns}
            onUpdate={(ad_patterns) => update({ ad_patterns })}
          />
        </div>

        {/* Right: nav keywords + params + test */}
        <div className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto">
          <NavKeywordPanel
            keywords={cf.nav_keywords}
            onUpdate={(nav_keywords) => update({ nav_keywords })}
          />
          <FilterParamsCard config={cf} onUpdate={update} />
          <ContentCleanTestPanel config={cf} />
        </div>
      </div>
    </div>
  );
}

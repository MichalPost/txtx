import { useMemo, useRef } from "react";
import { Download, FlaskConical, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { ContentFilterConfig } from "@/types";

import { AdPatternPanel } from "./AdPatternPanel";
import { ContentCleanTestPanel } from "./ContentCleanTestPanel";
import { FilterParamsCard } from "./FilterParamsCard";
import { buildImportSummary, mergeUniqueStrings, serializeFilterDraft } from "./filterPageUtils";
import { NavKeywordPanel } from "./NavKeywordPanel";

interface ContentCleanTabProps {
  config: ContentFilterConfig;
  saving: boolean;
  onChange: (next: ContentFilterConfig) => void;
  onSave: (next: ContentFilterConfig) => Promise<void>;
  onSaved?: (snapshot: string) => void;
}

export function ContentCleanTab({
  config: cf,
  saving,
  onChange,
  onSave,
  onSaved,
}: ContentCleanTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const summary = useMemo(
    () => [
      `${cf.ad_patterns.length} 条广告规则`,
      `${cf.nav_keywords.length} 个导航词`,
      `安全阈值 ${Math.round(cf.safety_threshold * 100)}%`,
      `兜底裁剪 ${cf.fallback_trim_lines} 行`,
    ],
    [cf],
  );

  const update = (patch: Partial<ContentFilterConfig>) => {
    onChange({ ...cf, ...patch });
  };

  const handleSave = async () => {
    await onSave(cf);
    onSaved?.(serializeFilterDraft(cf));
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
        const ad_patterns = Array.isArray(parsed.ad_patterns)
          ? parsed.ad_patterns.map((item) => String(item).trim()).filter(Boolean)
          : [];
        const nav_keywords = Array.isArray(parsed.nav_keywords)
          ? parsed.nav_keywords.map((item) => String(item).trim()).filter(Boolean)
          : [];
        const nextPatterns = mergeUniqueStrings(cf.ad_patterns, ad_patterns);
        const nextKeywords = mergeUniqueStrings(cf.nav_keywords, nav_keywords);
        update({
          ad_patterns: nextPatterns,
          nav_keywords: nextKeywords,
        });
        const feedback = [
          buildImportSummary(
            nextPatterns.length - cf.ad_patterns.length,
            ad_patterns.length - (nextPatterns.length - cf.ad_patterns.length),
            0,
            "广告规则",
          ),
          buildImportSummary(
            nextKeywords.length - cf.nav_keywords.length,
            nav_keywords.length - (nextKeywords.length - cf.nav_keywords.length),
            0,
            "导航词",
          ),
        ]
          .filter(Boolean)
          .join("；");
        toast.success(feedback || "导入完成");
      } catch {
        toast.error("文件格式不正确，无法导入");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <Card inset className="shrink-0">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
              先清除广告与页脚导航，再用安全阈值防止误删整段正文，适合在落地前用预览面板反复试跑。
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.map((item) => (
                <span
                  key={item}
                  className="rounded-full px-2.5 py-1 text-xs"
                  style={{ background: "var(--color-surface)", color: "var(--color-text-muted)" }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div
            className="rounded-2xl border px-4 py-3 text-xs leading-relaxed xl:max-w-sm"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-text-muted)",
            }}
          >
            左侧维护广告正则，右侧维护导航关键词和安全参数。测试预览会展示每一行是否被删除，以及是否触发安全回退。
          </div>
        </div>
      </Card>

      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            {cf.ad_patterns.length} 条广告规则，{cf.nav_keywords.length} 个导航词，建议每次调整后先在测试面板验证
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            disabled={cf.ad_patterns.length === 0 && cf.nav_keywords.length === 0}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:opacity-80"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
              background: "transparent",
            }}
          >
            <Download className="h-3 w-3" /> 导出
          </button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
            <Save className="h-3.5 w-3.5" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <AdPatternPanel
            patterns={cf.ad_patterns}
            onUpdate={(ad_patterns) => update({ ad_patterns })}
          />
        </div>

        <div className="flex min-h-0 flex-col gap-3 xl:overflow-y-auto">
          {cf.ad_patterns.length === 0 && cf.nav_keywords.length === 0 ? (
            <Card
              title="先准备一段样本文本"
              actions={<FlaskConical className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />}
            >
              <div className="flex flex-col gap-2 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                <p>先粘贴一段真实章节，把明显广告、站点口号和“上一章 / 下一章 / 返回目录”这类尾部导航提炼成规则。</p>
                <p>如果删得太狠，优先提高安全阈值，再收紧广告正则，而不是一次性堆很多模糊规则。</p>
              </div>
            </Card>
          ) : null}
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

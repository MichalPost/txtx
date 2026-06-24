import { useMemo, useRef } from "react";
import { Download, FileDown, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { FilterSettingsCard } from "@/pages/blacklist/FilterSettingsCard";
import { KeywordPanel } from "@/pages/blacklist/KeywordPanel";
import { RegexPanel } from "@/pages/blacklist/RegexPanel";
import { TagPanel } from "@/pages/blacklist/TagPanel";
import type { BlacklistConfig } from "@/types";

import { BlacklistTestPanel } from "./BlacklistTestPanel";
import { buildImportSummary, mergeUniqueStrings, serializeFilterDraft } from "./filterPageUtils";
import { WhitelistPanel } from "./WhitelistPanel";

interface BlacklistTabProps {
  blacklist: BlacklistConfig;
  saving: boolean;
  onChange: (next: BlacklistConfig) => void;
  onSave: (next: BlacklistConfig) => Promise<void>;
  onSaved?: (snapshot: string) => void;
}

export function BlacklistTab({
  blacklist: currentBlacklist,
  saving,
  onChange,
  onSave,
  onSaved,
}: BlacklistTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const summary = useMemo(
    () =>
      currentBlacklist
        ? [
            `${currentBlacklist.enabled ? "已启用" : "未启用"} 黑名单`,
            `${currentBlacklist.keywords.length} 个关键词`,
            `${currentBlacklist.regex_patterns.length} 条正则`,
            `${currentBlacklist.whitelist?.length ?? 0} 个白名单`,
          ]
        : [],
    [currentBlacklist],
  );

  const update = (patch: Partial<typeof currentBlacklist>) => {
    onChange({ ...currentBlacklist, ...patch });
  };

  const handleSave = async () => {
    await onSave(currentBlacklist);
    onSaved?.(serializeFilterDraft(currentBlacklist));
  };

  const handleExport = () => {
    const data: Partial<BlacklistConfig> = {
      keywords: currentBlacklist.keywords,
      regex_patterns: currentBlacklist.regex_patterns,
      whitelist: currentBlacklist.whitelist ?? [],
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
        const keywords = Array.isArray(parsed.keywords)
          ? parsed.keywords.map((item) => String(item).trim()).filter(Boolean)
          : [];
        const regex_patterns = Array.isArray(parsed.regex_patterns)
          ? parsed.regex_patterns.map((item) => String(item).trim()).filter(Boolean)
          : [];
        const whitelist = Array.isArray(parsed.whitelist)
          ? parsed.whitelist.map((item) => String(item).trim()).filter(Boolean)
          : [];
        const merged = {
          keywords: mergeUniqueStrings(currentBlacklist.keywords, keywords),
          regex_patterns: mergeUniqueStrings(currentBlacklist.regex_patterns, regex_patterns),
          whitelist: mergeUniqueStrings(currentBlacklist.whitelist ?? [], whitelist),
        };
        update(merged);
        const feedback = [
          buildImportSummary(
            merged.keywords.length - currentBlacklist.keywords.length,
            keywords.length - (merged.keywords.length - currentBlacklist.keywords.length),
            0,
            "关键词",
          ),
          buildImportSummary(
            merged.regex_patterns.length - currentBlacklist.regex_patterns.length,
            regex_patterns.length -
              (merged.regex_patterns.length - currentBlacklist.regex_patterns.length),
            0,
            "正则",
          ),
          buildImportSummary(
            merged.whitelist.length - (currentBlacklist.whitelist?.length ?? 0),
            whitelist.length -
              (merged.whitelist.length - (currentBlacklist.whitelist?.length ?? 0)),
            0,
            "白名单",
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
              用于拦截不想下载的书名、作者或标签组合，建议先维护关键词，再补充高精度正则。
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
            导入适合迁移旧规则，导出适合备份或团队共享；右侧测试面板可以直接验证某本书会不会被拦截。
          </div>
        </div>
      </Card>

      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            {currentBlacklist.keywords.length} 个关键词，{currentBlacklist.regex_patterns.length}{" "}
            条正则，支持模糊搜索与正则补充过滤
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
            disabled={
              currentBlacklist.keywords.length === 0 &&
              currentBlacklist.regex_patterns.length === 0 &&
              (currentBlacklist.whitelist?.length ?? 0) === 0
            }
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

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <KeywordPanel
            keywords={currentBlacklist.keywords}
            onUpdate={(keywords) => update({ keywords })}
          />
          <WhitelistPanel
            whitelist={currentBlacklist.whitelist ?? []}
            onUpdate={(whitelist) => update({ whitelist })}
          />
        </div>

        <div className="flex min-h-0 flex-col gap-3 xl:overflow-y-auto">
          {currentBlacklist.keywords.length === 0 && currentBlacklist.regex_patterns.length === 0 ? (
            <Card
              title="从这里开始"
              actions={<FileDown className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />}
            >
              <div className="flex flex-col gap-2 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                <p>如果你还没有规则，先加 3 到 5 个最常见的屏蔽词，比如站点名、推广词或已知垃圾书名片段。</p>
                <p>再用右侧测试框输入真实书名，确认不会误杀目标作品后再保存。</p>
              </div>
            </Card>
          ) : null}
          <FilterSettingsCard blacklist={currentBlacklist} onUpdate={update} />
          <RegexPanel
            patterns={currentBlacklist.regex_patterns}
            onUpdate={(regex_patterns) => update({ regex_patterns })}
          />
          {currentBlacklist.tag_filter && (
            <TagPanel
              tags={currentBlacklist.filtered_tags ?? []}
              onUpdate={(filtered_tags) => update({ filtered_tags })}
            />
          )}
          <BlacklistTestPanel blacklist={currentBlacklist} />
        </div>
      </div>
    </div>
  );
}

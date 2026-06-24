import {
  CircleOff,
  ChevronDown,
  FileText,
  Filter,
  Globe,
  ListChecks,
  PlusCircle,
  RotateCcw,
  Search,
} from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import type { ScanItem } from "@/types";

import { ExportDropdown } from "./ExportDropdown";
import type { ScanSiteSummary } from "./scanPreviewUtils";
import type { FilterTab } from "./useScanFilter";

export type ScanViewMode = "flat" | "grouped";

export function ScanToolbar({
  scanItems,
  selectedUrls,
  search,
  tab,
  viewMode,
  showSiteFilter,
  showExport,
  pendingCount,
  excludedCount,
  allPendingSelected,
  siteSummaries,
  blacklistCount,
  localCount,
  onSearchChange,
  onTabChange,
  onViewModeChange,
  onSelectAll,
  onToggleSiteFilter,
  onSelectBySite,
  onForceAddAllBlacklisted,
  onForceAddAllLocal,
  onToggleExport,
  onCloseExport,
  onBackToLauncher,
}: {
  scanItems: ScanItem[];
  selectedUrls: Set<string>;
  search: string;
  tab: FilterTab;
  viewMode: ScanViewMode;
  showSiteFilter: boolean;
  showExport: boolean;
  pendingCount: number;
  excludedCount: number;
  allPendingSelected: boolean;
  siteSummaries: ScanSiteSummary[];
  blacklistCount: number;
  localCount: number;
  onSearchChange: (value: string) => void;
  onTabChange: (tab: FilterTab) => void;
  onViewModeChange: (mode: ScanViewMode) => void;
  onSelectAll: (value: boolean) => void;
  onToggleSiteFilter: () => void;
  onSelectBySite: (site: string) => void;
  onForceAddAllBlacklisted: () => void;
  onForceAddAllLocal: () => void;
  onToggleExport: () => void;
  onCloseExport: () => void;
  onBackToLauncher: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <div
        className="flex overflow-hidden rounded-lg border"
        style={{ borderColor: "var(--color-border)" }}
      >
        {(
          [
            ["all", `全部 ${scanItems.length}`],
            ["pending", `待下载 ${pendingCount}`],
            ["excluded", `已排除 ${excludedCount}`],
          ] as [FilterTab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className="px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: tab === t ? "var(--color-accent)" : "var(--color-surface-1)",
              color: tab === t ? "#fff" : "var(--color-text-muted)",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="relative min-w-28 flex-1">
        <Search
          className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
          style={{ color: "var(--color-text-subtle)" }}
        />
        <Input
          id="scan-preview-search"
          name="scan-preview-search"
          aria-label="搜索扫描结果"
          className="h-8 w-full pl-8 text-xs"
          placeholder="搜索书名或站点..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div
        className="flex overflow-hidden rounded-lg border"
        style={{ borderColor: "var(--color-border)" }}
      >
        {(
          [
            ["grouped", "分组", Globe],
            ["flat", "列表", ListChecks],
          ] as [ScanViewMode, string, typeof Globe][]
        ).map(([mode, label, Icon]) => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: viewMode === mode ? "var(--color-accent)" : "var(--color-surface-1)",
              color: viewMode === mode ? "#fff" : "var(--color-text-muted)",
            }}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => onSelectAll(!allPendingSelected)}>
          <ListChecks className="h-3.5 w-3.5" />
          {allPendingSelected ? "取消全选" : "全选待下载"}
        </Button>
        <div className="relative">
          <Button variant="ghost" size="sm" onClick={onToggleSiteFilter}>
            <Globe className="h-3.5 w-3.5" /> 按站点
            <ChevronDown className="h-3 w-3" />
          </Button>
          {showSiteFilter && (
            <div
              className="absolute top-full right-0 z-50 mt-1 min-w-40 overflow-hidden rounded-lg border shadow-lg"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              {siteSummaries.length > 0 ? (
                siteSummaries.map(({ pendingCount, label, site }) => (
                  <button
                    key={site}
                    onClick={() => onSelectBySite(site)}
                    className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-xs transition-opacity last:border-0 hover:opacity-80"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  >
                    <span className="truncate">{label}</span>
                    <span style={{ color: "var(--color-accent)" }}>{pendingCount}</span>
                  </button>
                ))
              ) : (
                <div
                  className="flex items-center gap-2 px-3 py-2 text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <CircleOff className="h-3.5 w-3.5" />
                  当前没有可选站点
                </div>
              )}
              {blacklistCount > 0 && (
                <button
                  onClick={onForceAddAllBlacklisted}
                  className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-xs transition-opacity hover:opacity-80"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-warning)" }}
                >
                  <Filter className="h-3 w-3" /> 全部黑名单加入 ({blacklistCount})
                </button>
              )}
              {localCount > 0 && (
                <button
                  onClick={onForceAddAllLocal}
                  className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-xs transition-opacity hover:opacity-80"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
                >
                  <PlusCircle className="h-3 w-3" /> 全部已存在加入 ({localCount})
                </button>
              )}
            </div>
          )}
        </div>
        <div className="relative">
          <Button variant="ghost" size="sm" onClick={onToggleExport}>
            <FileText className="h-3.5 w-3.5" /> 导出
            <ChevronDown className="h-3 w-3" />
          </Button>
          {showExport && (
            <ExportDropdown
              scanItems={scanItems}
              selectedUrls={selectedUrls}
              onClose={onCloseExport}
            />
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onBackToLauncher}>
          <RotateCcw className="h-3.5 w-3.5" /> 返回任务发起台
        </Button>
      </div>
    </div>
  );
}

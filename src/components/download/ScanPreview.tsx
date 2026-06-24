import { startTransition, useEffect, useRef, useState } from "react";
import { RotateCcw, SearchX } from "lucide-react";

import { Button } from "@/components/Button";
import { animateCountUp } from "@/lib/animations";
import { usePersistedState } from "@/lib/persist";
import { useAppNavigate } from "@/router";
import { useDownloadStore } from "@/store/downloadStore";

import { FlatScanTable } from "./scan-preview/FlatScanTable";
import { GroupedScanTable } from "./scan-preview/GroupedScanTable";
import { ScanActionBar } from "./scan-preview/ScanActionBar";
import { ScanStatsBar } from "./scan-preview/ScanStatsBar";
import { ScanToolbar, type ScanViewMode } from "./scan-preview/ScanToolbar";
import { useScanFilter } from "./scan-preview/useScanFilter";
import { useScanPreviewActions } from "./scan-preview/useScanPreviewActions";

export function ScanPreview() {
  const {
    scanItems,
    selectedUrls,
    scanStats,
    toggleSelect,
    selectUrls,
    selectAll,
    startSelectedDownload,
    reset,
  } = useDownloadStore();

  const { search, setSearch, tab, setTab, sortField, sortAsc, filtered, toggleSort } =
    useScanFilter(scanItems);

  const [showExport, setShowExport] = useState(false);
  const [showSiteFilter, setShowSiteFilter] = useState(false);
  const [viewMode, setViewMode] = usePersistedState<ScanViewMode>("scan-view-mode", "grouped");
  const [showChart, setShowChart] = usePersistedState<boolean>("scan-show-chart", false);
  const selectedCountRef = useRef<HTMLSpanElement>(null);
  const prevSelectedCount = useRef(0);
  const navigate = useAppNavigate();

  const {
    pendingCount,
    excludedCount,
    selectedCount,
    siteSummaries,
    allPendingSelected,
    blacklistCount,
    localCount,
    forceAdd,
    selectBySite,
    forceAddAllBlacklisted,
    forceAddAllLocal,
  } = useScanPreviewActions({
    scanItems,
    selectedUrls,
    toggleSelect,
    selectUrls,
    onSiteFilterClose: () => setShowSiteFilter(false),
  });

  useEffect(() => {
    if (selectedCountRef.current && selectedCount !== prevSelectedCount.current) {
      animateCountUp(selectedCountRef.current, prevSelectedCount.current, selectedCount, 300);
      prevSelectedCount.current = selectedCount;
    }
  }, [selectedCount]);

  const hasFilters = search.trim().length > 0 || tab !== "all";

  return (
    <div className="flex h-full flex-col gap-3">
      <ScanStatsBar
        scanStats={scanStats}
        scanItems={scanItems}
        showChart={showChart}
        onToggleChart={() => setShowChart(!showChart)}
      />

      <ScanToolbar
        scanItems={scanItems}
        selectedUrls={selectedUrls}
        search={search}
        tab={tab}
        viewMode={viewMode}
        showSiteFilter={showSiteFilter}
        showExport={showExport}
        pendingCount={pendingCount}
        excludedCount={excludedCount}
        allPendingSelected={allPendingSelected}
        siteSummaries={siteSummaries}
        blacklistCount={blacklistCount}
        localCount={localCount}
        onSearchChange={setSearch}
        onTabChange={setTab}
        onViewModeChange={setViewMode}
        onSelectAll={selectAll}
        onToggleSiteFilter={() => startTransition(() => setShowSiteFilter((v) => !v))}
        onSelectBySite={selectBySite}
        onForceAddAllBlacklisted={forceAddAllBlacklisted}
        onForceAddAllLocal={forceAddAllLocal}
        onToggleExport={() => startTransition(() => setShowExport((v) => !v))}
        onCloseExport={() => setShowExport(false)}
        onBackToLauncher={() => {
          reset();
          navigate("/");
        }}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div
            className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-surface)",
            }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                background: "var(--color-surface-2)",
                color: "var(--color-text-subtle)",
              }}
            >
              <SearchX className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                {hasFilters ? "没有匹配的扫描结果" : "这次扫描没有找到可显示的书目"}
              </p>
              <p className="text-xs leading-5" style={{ color: "var(--color-text-muted)" }}>
                {hasFilters
                  ? "可以清空搜索词、切回全部状态，或调整筛选后再继续确认下载。"
                  : "可以返回重新发起扫描，或者先去规则页调整站点配置后再回来重试。"}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasFilters && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setTab("all");
                  }}
                >
                  清空筛选
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  reset();
                  navigate("/");
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" /> 返回重新扫描
              </Button>
            </div>
          </div>
        ) : viewMode === "grouped" && !search.trim() ? (
          <GroupedScanTable
            items={filtered}
            selectedUrls={selectedUrls}
            onToggle={toggleSelect}
            onSelectUrls={selectUrls}
            onForceAdd={forceAdd}
          />
        ) : (
          <FlatScanTable
            filtered={filtered}
            selectedUrls={selectedUrls}
            allPendingSelected={allPendingSelected}
            search={search}
            sortField={sortField}
            sortAsc={sortAsc}
            onSelectAll={selectAll}
            onToggleSort={toggleSort}
            onToggle={toggleSelect}
            onForceAdd={forceAdd}
          />
        )}
      </div>

      <ScanActionBar
        selectedCount={selectedCount}
        pendingCount={pendingCount}
        selectedCountRef={selectedCountRef}
        onGoTasks={() => {
          reset();
          navigate("/tasks");
        }}
        onStartDownload={startSelectedDownload}
      />
    </div>
  );
}

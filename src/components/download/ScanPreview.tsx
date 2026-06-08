import { useEffect, useRef, useState } from "react";

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

// ─── ScanPreview ─────────────────────────────────────────────────────────────

export function ScanPreview() {
  const {
    scanItems,
    selectedUrls,
    scanStats,
    toggleSelect,
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
    sites,
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
    onSiteFilterClose: () => setShowSiteFilter(false),
  });

  useEffect(() => {
    if (selectedCountRef.current && selectedCount !== prevSelectedCount.current) {
      animateCountUp(selectedCountRef.current, prevSelectedCount.current, selectedCount, 300);
      prevSelectedCount.current = selectedCount;
    }
  }, [selectedCount]);

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
        sites={sites}
        blacklistCount={blacklistCount}
        localCount={localCount}
        onSearchChange={setSearch}
        onTabChange={setTab}
        onViewModeChange={setViewMode}
        onSelectAll={selectAll}
        onToggleSiteFilter={() => setShowSiteFilter((v) => !v)}
        onSelectBySite={selectBySite}
        onForceAddAllBlacklisted={forceAddAllBlacklisted}
        onForceAddAllLocal={forceAddAllLocal}
        onToggleExport={() => setShowExport((v) => !v)}
        onCloseExport={() => setShowExport(false)}
        onBackToLauncher={() => {
          reset();
          navigate("/");
        }}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        {viewMode === "grouped" && !search.trim() ? (
          <GroupedScanTable
            items={filtered}
            selectedUrls={selectedUrls}
            onToggle={toggleSelect}
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

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart2,
  ChevronDown,
  Download,
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
import { animateCountUp } from "@/lib/animations";
import { usePersistedState } from "@/lib/persist";
import { useAppNavigate } from "@/router";
import { useDownloadStore } from "@/store/downloadStore";
import type { ScanItem } from "@/types";

import { ExportDropdown } from "./scan-preview/ExportDropdown";
import { GroupedScanTable } from "./scan-preview/GroupedScanTable";
import { ScanRow } from "./scan-preview/ScanRow";
import { SiteStatsChart } from "./scan-preview/SiteStatsChart";
import { useScanFilter } from "./scan-preview/useScanFilter";

// ─── ScanPreview ─────────────────────────────────────────────────────────────

type ViewMode = "flat" | "grouped";

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
  const [viewMode, setViewMode] = usePersistedState<ViewMode>("scan-view-mode", "grouped");
  const [showChart, setShowChart] = usePersistedState<boolean>("scan-show-chart", false);
  const selectedCountRef = useRef<HTMLSpanElement>(null);
  const prevSelectedCount = useRef(0);
  const navigate = useAppNavigate();

  const pendingCount = scanItems.filter((i) => !i.excluded_reason).length;
  const excludedCount = scanItems.filter((i) => !!i.excluded_reason).length;
  const selectedCount = selectedUrls.size;

  useEffect(() => {
    if (selectedCountRef.current && selectedCount !== prevSelectedCount.current) {
      animateCountUp(selectedCountRef.current, prevSelectedCount.current, selectedCount, 300);
      prevSelectedCount.current = selectedCount;
    }
  }, [selectedCount]);

  const sites = useMemo(() => [...new Set(scanItems.map((i) => i.site))], [scanItems]);
  const allPendingSelected = pendingCount > 0 && pendingCount === selectedCount;
  const blacklistCount = scanItems.filter((i) => i.excluded_reason?.startsWith("黑名单")).length;
  const localCount = scanItems.filter((i) => i.excluded_reason === "本地已存在").length;

  function SortIcon({ field }: { field: "name" | "site" | "date" }) {
    if (sortField !== field) return null;
    return sortAsc ? (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="ml-0.5 inline h-3 w-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    ) : (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="ml-0.5 inline h-3 w-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    );
  }

  function forceAdd(item: ScanItem) {
    if (!selectedUrls.has(item.url)) toggleSelect(item.url);
  }

  function selectBySite(site: string) {
    const urls = scanItems.filter((i) => i.site === site && !i.excluded_reason).map((i) => i.url);
    urls.forEach((u) => {
      if (!selectedUrls.has(u)) toggleSelect(u);
    });
    setShowSiteFilter(false);
  }

  function forceAddAllBlacklisted() {
    scanItems
      .filter((i) => i.excluded_reason?.startsWith("黑名单"))
      .forEach((i) => {
        if (!selectedUrls.has(i.url)) toggleSelect(i.url);
      });
  }

  function forceAddAllLocal() {
    scanItems
      .filter((i) => i.excluded_reason === "本地已存在")
      .forEach((i) => {
        if (!selectedUrls.has(i.url)) toggleSelect(i.url);
      });
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Stats bar */}
      {scanStats && (
        <div className="flex min-w-0 shrink-0 flex-wrap gap-2">
          {(
            [
              ["收集", scanStats.total_collected, "var(--color-text-muted)"],
              ["去重后", scanStats.after_dedup, "var(--color-text-muted)"],
              ["黑名单", scanStats.blacklist_filtered, "var(--color-warning)"],
              ["已存在", scanStats.local_exists, "var(--color-text-muted)"],
              ["待下载", scanStats.final_download, "var(--color-accent)"],
            ] as [string, number, string][]
          ).map(([label, val, color]) => (
            <div
              key={label}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
              <span className="font-semibold tabular-nums" style={{ color }}>
                {val}
              </span>
            </div>
          ))}
          <button
            onClick={() => setShowChart(!showChart)}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
            style={{
              background: showChart
                ? "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))"
                : "var(--color-surface)",
              borderColor: showChart ? "var(--color-accent)" : "var(--color-border)",
              color: showChart ? "var(--color-accent)" : "var(--color-text-muted)",
            }}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            分布图
          </button>
        </div>
      )}

      {showChart && (
        <div className="shrink-0">
          <SiteStatsChart items={scanItems} />
        </div>
      )}

      {/* Toolbar */}
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
            ] as [typeof tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
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
            className="h-8 w-full pl-8 text-xs"
            placeholder="搜索书名或站点..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            ] as [ViewMode, string, typeof Globe][]
          ).map(([mode, label, Icon]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
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
        {/* Right-side actions — wrap as a unit */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => selectAll(!allPendingSelected)}>
            <ListChecks className="h-3.5 w-3.5" />
            {allPendingSelected ? "取消全选" : "全选待下载"}
          </Button>
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => setShowSiteFilter((v) => !v)}>
              <Globe className="h-3.5 w-3.5" /> 按站点
              <ChevronDown className="h-3 w-3" />
            </Button>
            {showSiteFilter && (
              <div
                className="absolute top-full right-0 z-50 mt-1 min-w-40 overflow-hidden rounded-lg border shadow-lg"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                {sites.map((site) => {
                  const count = scanItems.filter(
                    (i) => i.site === site && !i.excluded_reason,
                  ).length;
                  return (
                    <button
                      key={site}
                      onClick={() => selectBySite(site)}
                      className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-xs transition-opacity last:border-0 hover:opacity-80"
                      style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
                    >
                      <span className="truncate">{site.replace(/^https?:\/\//, "")}</span>
                      <span style={{ color: "var(--color-accent)" }}>{count}</span>
                    </button>
                  );
                })}
                {blacklistCount > 0 && (
                  <button
                    onClick={forceAddAllBlacklisted}
                    className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-xs transition-opacity hover:opacity-80"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-warning)" }}
                  >
                    <Filter className="h-3 w-3" /> 全部黑名单加入 ({blacklistCount})
                  </button>
                )}
                {localCount > 0 && (
                  <button
                    onClick={forceAddAllLocal}
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
            <Button variant="ghost" size="sm" onClick={() => setShowExport((v) => !v)}>
              <FileText className="h-3.5 w-3.5" /> 导出
              <ChevronDown className="h-3 w-3" />
            </Button>
            {showExport && (
              <ExportDropdown
                scanItems={scanItems}
                selectedUrls={selectedUrls}
                onClose={() => setShowExport(false)}
              />
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              navigate("/");
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> 返回任务发起台
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto">
        {viewMode === "grouped" && !search.trim() ? (
          <GroupedScanTable
            items={filtered}
            selectedUrls={selectedUrls}
            onToggle={toggleSelect}
            onForceAdd={forceAdd}
          />
        ) : (
          <div className="rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10" style={{ background: "var(--color-surface-1)" }}>
                <tr>
                  <th className="w-10 px-3 py-2.5 text-left">
                    <input
                      type="checkbox"
                      checked={allPendingSelected}
                      onChange={(e) => selectAll(e.target.checked)}
                      className="rounded focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                      style={{ accentColor: "var(--color-accent)" }}
                    />
                  </th>
                  <th
                    className="cursor-pointer px-3 py-2.5 text-left font-medium select-none"
                    style={{ color: "var(--color-text-muted)" }}
                    onClick={() => toggleSort("name")}
                  >
                    书名 <SortIcon field="name" />
                  </th>
                  <th
                    className="w-36 cursor-pointer px-3 py-2.5 text-left font-medium select-none"
                    style={{ color: "var(--color-text-muted)" }}
                    onClick={() => toggleSort("site")}
                  >
                    来源 <SortIcon field="site" />
                  </th>
                  <th
                    className="w-28 cursor-pointer px-3 py-2.5 text-left font-medium select-none"
                    style={{ color: "var(--color-text-muted)" }}
                    onClick={() => toggleSort("date")}
                  >
                    日期 <SortIcon field="date" />
                  </th>
                  <th
                    className="w-36 px-3 py-2.5 text-left font-medium"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    状态
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-12 text-center text-sm"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {search ? `没有书名或站点匹配「${search}」` : "扫描完成后书单会出现在这里"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <ScanRow
                      key={item.url}
                      item={item}
                      checked={selectedUrls.has(item.url)}
                      onToggle={() => toggleSelect(item.url)}
                      onForceAdd={item.excluded_reason ? () => forceAdd(item) : undefined}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex shrink-0 items-center justify-between pt-1">
        <div
          className="flex items-center gap-3 text-sm"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>
            已选{" "}
            <span
              ref={selectedCountRef}
              className="font-semibold"
              style={{ color: "var(--color-accent)" }}
            >
              {selectedCount}
            </span>{" "}
            本
          </span>
          {selectedCount > pendingCount && (
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{
                background: "color-mix(in srgb, var(--color-warning) 12%, transparent)",
                color: "var(--color-warning)",
              }}
            >
              含 {selectedCount - pendingCount} 本强制加入
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              reset();
              navigate("/tasks");
            }}
          >
            <ArrowRight className="h-3.5 w-3.5" /> 去任务管理
          </Button>
          <Button size="sm" onClick={startSelectedDownload} disabled={selectedCount === 0}>
            <Download className="h-3.5 w-3.5" /> 开始下载{" "}
            {selectedCount > 0 ? `(${selectedCount})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

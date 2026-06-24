import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { BarChart2, Download, Filter, RefreshCw, RotateCcw, Search, TableIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import { apiClearHistory, apiQueryHistory, type HistoryQuery } from "@/lib/api";
import { apiSaveTextFile } from "@/lib/api/files";
import { usePersistedState } from "@/lib/persist";
import { formatTaskRetryError } from "@/lib/taskRetryError";
import { formatToolActionError } from "@/lib/toolActionError";
import { useAppNavigate } from "@/router";
import { useTaskStore } from "@/store/taskStore";
import { hasRunningTask } from "@/store/taskStoreUtils";

import { buildHistoryColumns } from "./historyColumns";
import { buildHistoryCsv, buildHistoryExportFilename } from "./historyExportUtils";
import { buildHistoryEmptyStateSummary } from "./historyFilterUtils";
import { HistoryPagination } from "./HistoryPagination";
import { clampHistoryPageForTotal, normalizeHistoryPageState } from "./historyPaginationUtils";
import {
  buildHistorySelectionSummary,
  getHistoryEntryKey,
  getRetryableHistoryKeys,
  reconcileHistorySelection,
  setHistorySelectionForKeys,
  toggleHistorySelection,
} from "./historySelectionUtils";
import { buildHistorySiteOptions, getNextHistorySort } from "./historySortingUtils";
import { useHistorySiteOptions } from "./useHistoryStats";
const HistoryStatsPanel = lazy(async () => {
  const mod = await import("./HistoryStatsPanel");
  return { default: mod.HistoryStatsPanel };
});

export function HistoryPage() {
  const qc = useQueryClient();
  const { createSingleTask, tasks } = useTaskStore();
  const navigate = useAppNavigate();
  const isRunning = hasRunningTask(tasks);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "success" | "error">("");
  const [siteFilter, setSiteFilter] = useState("");
  const [pageSize, setPageSize] = usePersistedState<number>("history-page-size", 50);
  const [page, setPage] = useState(1);
  const [showStats, setShowStats] = usePersistedState<boolean>("history-show-stats", false);
  const [sortBy, setSortBy] = usePersistedState<"downloaded_at" | "name" | "site" | "status">(
    "history-sort-by",
    "downloaded_at",
  );
  const [sortOrder, setSortOrder] = usePersistedState<"asc" | "desc">("history-sort-order", "desc");
  const [activeSearch, setActiveSearch] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [selectedHistoryKeys, setSelectedHistoryKeys] = useState<Set<string>>(() => new Set());
  const [bulkRetrying, setBulkRetrying] = useState(false);
  const [bulkRetryConfirming, setBulkRetryConfirming] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const deferredSearch = useDeferredValue(search);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { siteOptions: siteOptionsFromQuery } = useHistorySiteOptions();
  const normalizedPageState = useMemo(
    () => normalizeHistoryPageState({ page, pageSize }),
    [page, pageSize],
  );

  const historyQuery = useMemo<HistoryQuery>(
    () => ({
      page: normalizedPageState.page,
      page_size: normalizedPageState.pageSize,
      search: activeSearch || undefined,
      status: statusFilter || undefined,
      site: siteFilter || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    }),
    [normalizedPageState, activeSearch, siteFilter, sortBy, sortOrder, statusFilter],
  );

  useEffect(() => {
    if (deferredSearch === activeSearch) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
      setActiveSearch(deferredSearch.trim());
    }, 250);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [activeSearch, deferredSearch]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["history", historyQuery],
    queryFn: () => apiQueryHistory(historyQuery),
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  });

  useEffect(() => {
    const total = data?.total ?? 0;
    const totalPages = Math.ceil(total / normalizedPageState.pageSize);
    if (!data || normalizedPageState.page >= totalPages) return;

    const nextQuery: HistoryQuery = { ...historyQuery, page: normalizedPageState.page + 1 };
    void qc.prefetchQuery({
      queryKey: ["history", nextQuery],
      queryFn: () => apiQueryHistory(nextQuery),
      staleTime: 10_000,
    });
  }, [data, historyQuery, normalizedPageState, qc]);

  useEffect(() => {
    if (page !== normalizedPageState.page) setPage(normalizedPageState.page);
    if (pageSize !== normalizedPageState.pageSize) setPageSize(normalizedPageState.pageSize);
  }, [normalizedPageState, page, pageSize, setPageSize]);

  const clearMutation = useMutation({
    mutationFn: apiClearHistory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: ["history-stats"] });
      qc.invalidateQueries({ queryKey: ["history-site-options"] });
      toast.success("历史已清空");
      setSearch("");
      setActiveSearch("");
      setStatusFilter("");
      setSiteFilter("");
      setPage(1);
      setConfirmingClear(false);
    },
    onError: (error) => toast.error(formatToolActionError("清空历史", error)),
  });

  const handleSearch = () => {
    const nextSearch = search.trim();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setActiveSearch(nextSearch);
    setSearch(nextSearch);
    setPage(1);
  };

  const handleRefresh = async () => {
    const result = await refetch();
    if (result.error) {
      toast.error(formatToolActionError("刷新历史", result.error));
    }
  };

  const handleExportCurrentPage = async () => {
    if (entries.length === 0) return;
    try {
      await apiSaveTextFile(buildHistoryExportFilename(), buildHistoryCsv(entries));
      toast.success(`已导出当前页 ${entries.length} 条历史记录`);
    } catch (error) {
      toast.error(formatToolActionError("导出历史", error));
    }
  };

  const handleRedownload = useCallback(
    async (url: string, name: string) => {
      if (isRunning) {
        toast.error("当前有任务正在运行");
        return;
      }
      try {
        await createSingleTask(url);
        toast.success(`已创建重新下载任务：${name}`);
        navigate("/tasks");
      } catch (error) {
        toast.error(formatTaskRetryError(error));
        throw error;
      }
    },
    [createSingleTask, isRunning, navigate],
  );

  const entries = useMemo(() => data?.entries ?? [], [data?.entries]);
  useEffect(() => {
    setSelectedHistoryKeys((current) => reconcileHistorySelection(current, entries));
  }, [entries]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / normalizedPageState.pageSize));
  const currentPage = clampHistoryPageForTotal({
    page: normalizedPageState.page,
    pageSize: normalizedPageState.pageSize,
    total,
  });
  useEffect(() => {
    if (currentPage !== page) setPage(currentPage);
  }, [currentPage, page]);
  const siteOptions = useMemo(
    () => buildHistorySiteOptions(entries, siteOptionsFromQuery, siteFilter),
    [entries, siteFilter, siteOptionsFromQuery],
  );
  const hasActiveFilters = Boolean(activeSearch || siteFilter || statusFilter);
  const selectionSummary = useMemo(
    () => buildHistorySelectionSummary(selectedHistoryKeys, entries),
    [entries, selectedHistoryKeys],
  );
  const retryableKeys = useMemo(() => getRetryableHistoryKeys(entries), [entries]);
  const handleSortChange = useCallback(
    (field: "downloaded_at" | "name" | "site" | "status") => {
      const nextSort = getNextHistorySort({ sortBy, sortOrder }, field);
      setSortBy(nextSort.sortBy);
      setSortOrder(nextSort.sortOrder);
      setPage(1);
    },
    [setSortBy, setSortOrder, sortBy, sortOrder],
  );

  const columns = useMemo(
    () =>
      buildHistoryColumns({
        isRunning,
        onRedownload: handleRedownload,
        isSelected: (entry) => selectedHistoryKeys.has(getHistoryEntryKey(entry)),
        onSelect: (entry, checked) => {
          setSelectedHistoryKeys((current) =>
            toggleHistorySelection(current, getHistoryEntryKey(entry), checked),
          );
        },
        sortBy,
        sortOrder,
        onSortChange: handleSortChange,
      }),
    [handleRedownload, handleSortChange, isRunning, selectedHistoryKeys, sortBy, sortOrder],
  );

  const handleBulkRetrySelected = async () => {
    if (isRunning || bulkRetrying || bulkRetryConfirming || selectionSummary.selectedEntries.length === 0) {
      return;
    }
    const selectedEntries = [...selectionSummary.selectedEntries];
    setBulkRetryConfirming(true);
    const confirmed = await confirm({
      title: `重下 ${selectedEntries.length} 条失败记录？`,
      description: "系统会为所选失败记录逐条创建新的下载任务。当前已有运行中任务时不会执行。",
      confirmLabel: "创建重下任务",
      tone: "warning",
    }).catch(() => false);
    setBulkRetryConfirming(false);
    if (!confirmed) return;

    setBulkRetrying(true);
    try {
      const results = await Promise.allSettled(
        selectedEntries.map((entry) => createSingleTask(entry.url)),
      );
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - successCount;
      if (successCount > 0) {
        toast.success(`已创建 ${successCount} 个重下任务`);
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} 条记录创建失败，请稍后重试`);
      }
      if (successCount > 0) {
        setSelectedHistoryKeys(new Set());
        navigate("/tasks");
      }
    } finally {
      setBulkRetrying(false);
    }
  };

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-5">
      <PageHeader
        title="下载历史"
        subtitle={`共 ${total} 条记录`}
        actions={
          <>
            <button
              onClick={() => setShowStats(!showStats)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: showStats
                  ? "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))"
                  : "var(--color-surface-2)",
                borderColor: showStats ? "var(--color-accent)" : "var(--color-border)",
                color: showStats ? "var(--color-accent)" : "var(--color-text-muted)",
              }}
            >
              <BarChart2 className="h-3.5 w-3.5" /> 统计图表
            </button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              {isFetching ? "刷新中..." : "刷新"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleExportCurrentPage()}
              disabled={entries.length === 0}
              title="导出当前页历史记录为 CSV"
            >
              <Download className="h-3.5 w-3.5" /> 导出当前页
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleBulkRetrySelected()}
              disabled={
                isRunning ||
                bulkRetrying ||
                bulkRetryConfirming ||
                selectionSummary.selectedRetryableCount === 0
              }
              title={
                isRunning
                  ? "当前有任务正在运行"
                  : selectionSummary.selectedRetryableCount > 0
                    ? `重下所选 ${selectionSummary.selectedRetryableCount} 条失败记录`
                    : "请先选择失败记录"
              }
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {bulkRetrying ? "创建中..." : bulkRetryConfirming ? "确认中..." : "重下所选"}
            </Button>
            {confirmingClear ? (
              <div
                className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                style={{
                  borderColor: "var(--color-border)",
                  background: "var(--color-surface-2)",
                }}
              >
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {clearMutation.isPending
                    ? "正在清空历史记录..."
                    : `确认清空 ${total} 条历史记录？此操作不可撤销。`}
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => clearMutation.mutate()}
                  disabled={clearMutation.isPending}
                >
                  {clearMutation.isPending ? "清空中..." : "确认清空"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingClear(false)}
                  disabled={clearMutation.isPending}
                >
                  取消
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingClear(true)}
                disabled={total === 0 || clearMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" /> 清空
              </Button>
            )}
          </>
        }
      />

      {showStats && (
        <Suspense
          fallback={
            <Card className="border-dashed">
              <div className="px-4 py-6 text-sm" style={{ color: "var(--color-text-muted)" }}>
                正在加载统计面板...
              </div>
            </Card>
          }
        >
          <HistoryStatsPanel onClose={() => setShowStats(false)} />
        </Suspense>
      )}

      {/* Filter bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div
          className="flex overflow-hidden rounded-[10px] border"
          style={{ borderColor: "var(--color-border)" }}
        >
          {(
            [
              ["", "全部"],
              ["success", "成功"],
              ["error", "失败"],
            ] as [typeof statusFilter, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => {
                setStatusFilter(v);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: statusFilter === v ? "var(--color-accent)" : "var(--color-surface-2)",
                color: statusFilter === v ? "#fff" : "var(--color-text-muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex min-w-48 flex-1 gap-2">
          <Input
            id="history-search"
            name="history-search"
            className="h-8 flex-1 text-xs"
            placeholder="搜索书名或站点..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            aria-label="搜索下载历史"
          />
          <Button size="sm" variant="secondary" onClick={handleSearch}>
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
        <select
          id="history-site-filter"
          name="history-site-filter"
          value={siteFilter}
          onChange={(e) => {
            setSiteFilter(e.target.value);
            setPage(1);
          }}
          className="h-8 min-w-40 rounded-lg border px-2 text-xs focus:outline-none"
          style={{
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
          }}
          aria-label="按站点筛选"
        >
          <option value="">全部站点</option>
          {siteOptions.map((site) => (
            <option key={site} value={site}>
              {site}
            </option>
          ))}
        </select>
        {activeSearch && (
          <button
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
            style={{
              background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
              color: "var(--color-accent)",
            }}
            onClick={() => {
              setActiveSearch("");
              setSearch("");
              setPage(1);
            }}
            aria-label={`清除搜索：${activeSearch}`}
          >
            <Filter className="h-3 w-3" /> {activeSearch}
            <span aria-hidden="true" className="ml-0.5">
              ×
            </span>
          </button>
        )}
        {siteFilter && (
          <button
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
            style={{
              background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
              color: "var(--color-accent)",
            }}
            onClick={() => {
              setSiteFilter("");
              setPage(1);
            }}
            aria-label={`清除站点筛选：${siteFilter}`}
          >
            <Filter className="h-3 w-3" /> {siteFilter}
            <span aria-hidden="true" className="ml-0.5">
              ×
            </span>
          </button>
        )}
        <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {isFetching
            ? "正在同步最新历史记录..."
            : "搜索支持书名、站点和链接关键词"}
        </span>
        {selectionSummary.retryableCount > 0 && (
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-xs transition-colors"
            style={{
              borderColor: "var(--color-border)",
              background: selectionSummary.allRetryableSelected
                ? "var(--color-accent-muted)"
                : "var(--color-surface-2)",
              color: selectionSummary.allRetryableSelected
                ? "var(--color-accent)"
                : "var(--color-text-muted)",
            }}
            onClick={() =>
              setSelectedHistoryKeys(
                setHistorySelectionForKeys(retryableKeys, !selectionSummary.allRetryableSelected),
              )
            }
          >
            {selectionSummary.allRetryableSelected
              ? "取消选择失败记录"
              : `选择本页 ${selectionSummary.retryableCount} 条失败记录`}
          </button>
        )}
      </div>

      {error && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <span>{String(error)}</span>
          <Button size="sm" variant="secondary" onClick={() => void handleRefresh()}>
            重试
          </Button>
        </div>
      )}

      <Card
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex flex-col flex-1 min-h-0 overflow-hidden p-0"
      >
        <div className="flex-1 overflow-auto">
          {entries.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-16">
              {isLoading ? (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  加载中...
                </p>
              ) : hasActiveFilters ? (
                <>
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <Search className="h-7 w-7" style={{ color: "var(--color-text-subtle)" }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                      当前筛选条件下没有匹配记录
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--color-text-subtle)" }}>
                      {buildHistoryEmptyStateSummary({ activeSearch, siteFilter, statusFilter })}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{
                      background: "var(--color-accent-muted)",
                      border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
                      boxShadow: "var(--shadow-accent)",
                    }}
                  >
                    <TableIcon className="h-7 w-7" style={{ color: "var(--color-accent)" }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                      还没有下载记录
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      下载完成后，记录会出现在这里
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10" style={{ background: "var(--color-surface-1)" }}>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className="border-b px-3 py-2.5 text-left text-xs font-semibold"
                        style={{
                          color: "var(--color-text-muted)",
                          borderColor: "var(--color-border)",
                          width: header.getSize() !== 150 ? header.getSize() : undefined,
                        }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className="group border-t transition-colors"
                    style={{
                      borderColor: "var(--color-border)",
                      background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-1)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-1)";
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <HistoryPagination
          page={currentPage}
          totalPages={totalPages}
          total={total}
          pageSize={normalizedPageState.pageSize}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </Card>
      {confirmDialog}
    </div>
  );
}

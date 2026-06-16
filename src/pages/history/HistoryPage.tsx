import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { BarChart2, Filter, RefreshCw, Search, TableIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import { apiClearHistory, apiQueryHistory, type HistoryQuery } from "@/lib/api";
import { usePersistedState } from "@/lib/persist";
import { formatToolActionError } from "@/lib/toolActionError";
import { formatTaskRetryError } from "@/lib/taskRetryError";
import { useAppNavigate } from "@/router";
import { useDownloadStore } from "@/store/downloadStore";
import { useTaskStore } from "@/store/taskStore";

import { buildHistoryColumns } from "./historyColumns";
import { HistoryPagination } from "./HistoryPagination";
import { HistoryStatsPanel } from "./HistoryStatsPanel";

const PAGE_SIZE = 50;

export function HistoryPage() {
  const qc = useQueryClient();
  const { phase } = useDownloadStore();
  const { createSingleTask } = useTaskStore();
  const navigate = useAppNavigate();
  const isRunning = phase === "scanning" || phase === "downloading";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "success" | "error">("");
  const [page, setPage] = useState(1);
  const [showStats, setShowStats] = usePersistedState<boolean>("history-show-stats", false);
  const [activeSearch, setActiveSearch] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);

  const buildQuery = useCallback(
    (): HistoryQuery => ({
      page,
      page_size: PAGE_SIZE,
      search: activeSearch || undefined,
      status: statusFilter || undefined,
    }),
    [page, activeSearch, statusFilter],
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["history", page, activeSearch, statusFilter],
    queryFn: () => apiQueryHistory(buildQuery()),
    placeholderData: (prev) => prev,
  });

  const clearMutation = useMutation({
    mutationFn: apiClearHistory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: ["history-stats"] });
      toast.success("历史已清空");
      setPage(1);
    },
    onError: (error) => toast.error(formatToolActionError("清空历史", error)),
  });

  const handleSearch = () => {
    setActiveSearch(search);
    setPage(1);
  };

  const handleRefresh = async () => {
    const result = await refetch();
    if (result.error) {
      toast.error(formatToolActionError("刷新历史", result.error));
    }
  };

  const handleRedownload = async (url: string, name: string) => {
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
  };

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const columns = buildHistoryColumns({ isRunning, onRedownload: handleRedownload });

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
            <Button variant="secondary" size="sm" onClick={() => void handleRefresh()} disabled={isLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> 刷新
            </Button>
            {confirmingClear ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  确认清空？
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setConfirmingClear(false);
                    clearMutation.mutate();
                  }}
                  disabled={clearMutation.isPending}
                >
                  清空
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

      {showStats && <HistoryStatsPanel onClose={() => setShowStats(false)} />}

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
            className="h-8 flex-1 text-xs"
            placeholder="搜索书名或站点..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button size="sm" variant="secondary" onClick={handleSearch}>
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
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
      </div>

      {error && (
        <div
          className="rounded-lg px-4 py-2 text-sm"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          {String(error)}
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
              ) : activeSearch ? (
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
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    没有匹配「{activeSearch}」的记录
                  </p>
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
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
        />
      </Card>
    </div>
  );
}

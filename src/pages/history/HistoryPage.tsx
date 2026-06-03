import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Trash2, RefreshCw, BarChart2, TableIcon, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { apiQueryHistory, apiClearHistory, type HistoryQuery } from "@/lib/api";
import { useDownloadStore } from "@/store/downloadStore";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { usePersistedState } from "@/lib/persist";
import { HistoryStatsPanel } from "./HistoryStatsPanel";
import { HistoryPagination } from "./HistoryPagination";
import { buildHistoryColumns } from "./historyColumns";

const PAGE_SIZE = 50;

export function HistoryPage() {
  const qc = useQueryClient();
  const { startSingleDownload, phase } = useDownloadStore();
  const isRunning = phase === "scanning" || phase === "downloading";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "success" | "error">("");
  const [page, setPage] = useState(1);
  const [showStats, setShowStats] = usePersistedState<boolean>("history-show-stats", false);
  const [activeSearch, setActiveSearch] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);

  const buildQuery = useCallback((): HistoryQuery => ({
    page,
    page_size: PAGE_SIZE,
    search: activeSearch || undefined,
    status: statusFilter || undefined,
  }), [page, activeSearch, statusFilter]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["history", page, activeSearch, statusFilter],
    queryFn: () => apiQueryHistory(buildQuery()),
    placeholderData: prev => prev,
  });

  const clearMutation = useMutation({
    mutationFn: apiClearHistory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: ["history-stats"] });
      toast.success("历史已清空");
      setPage(1);
    },
    onError: (e) => toast.error(String(e)),
  });

  const handleSearch = () => {
    setActiveSearch(search);
    setPage(1);
  };

  const handleRedownload = (url: string, name: string) => {
    if (isRunning) { toast.error("当前有任务正在运行"); return; }
    startSingleDownload(url);
    toast.success(`开始重新下载：${name}`);
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
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">
      <PageHeader
        title="下载历史"
        subtitle={`共 ${total} 条记录`}
        actions={
          <>
            <button
              onClick={() => setShowStats(!showStats)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
              style={{
                background: showStats
                  ? "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))"
                  : "var(--color-surface-2)",
                borderColor: showStats ? "var(--color-accent)" : "var(--color-border)",
                color: showStats ? "var(--color-accent)" : "var(--color-text-muted)",
              }}
            >
              <BarChart2 className="w-3.5 h-3.5" /> 统计图表
            </button>
            <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> 刷新
            </Button>
            {confirmingClear ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>确认清空？</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => { setConfirmingClear(false); clearMutation.mutate(); }}
                  disabled={clearMutation.isPending}
                >
                  清空
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingClear(false)}>
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
                <Trash2 className="w-3.5 h-3.5" /> 清空
              </Button>
            )}
          </>
        }
      />

      {showStats && <HistoryStatsPanel onClose={() => setShowStats(false)} />}

      {/* Filter bar */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <div
          className="flex rounded-[10px] overflow-hidden border"
          style={{ borderColor: "var(--color-border)" }}
        >
          {([["", "全部"], ["success", "成功"], ["error", "失败"]] as [typeof statusFilter, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => { setStatusFilter(v); setPage(1); }}
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
        <div className="flex gap-2 flex-1 min-w-48">
          <Input
            className="flex-1 h-8 text-xs"
            placeholder="搜索书名或站点..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
          />
          <Button size="sm" variant="secondary" onClick={handleSearch}>
            <Search className="w-3.5 h-3.5" />
          </Button>
        </div>
        {activeSearch && (
          <button
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
            style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)", color: "var(--color-accent)" }}
            onClick={() => { setActiveSearch(""); setSearch(""); setPage(1); }}
            aria-label={`清除搜索：${activeSearch}`}
          >
            <Filter className="w-3 h-3" /> {activeSearch}
            <span aria-hidden="true" className="ml-0.5">×</span>
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 rounded-lg text-sm" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          {String(error)}
        </div>
      )}

      <Card className="flex-1 overflow-hidden flex flex-col min-h-0" bodyClassName="flex flex-col flex-1 min-h-0 overflow-hidden p-0">
        <div className="flex-1 overflow-auto">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
              {isLoading ? (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>加载中...</p>
              ) : activeSearch ? (
                <>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <Search className="w-7 h-7" style={{ color: "var(--color-text-subtle)" }} />
                  </div>
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    没有匹配「{activeSearch}」的记录
                  </p>
                </>
              ) : (
                <>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{
                      background: "var(--color-accent-muted)",
                      border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
                      boxShadow: "var(--shadow-accent)",
                    }}
                  >
                    <TableIcon className="w-7 h-7" style={{ color: "var(--color-accent)" }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                      还没有下载记录
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                      下载完成后，记录会出现在这里
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10" style={{ background: "var(--color-surface-1)" }}>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(header => (
                      <th
                        key={header.id}
                        className="text-left px-3 py-2.5 text-xs font-semibold border-b"
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
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-1)"; }}
                  >
                    {row.getVisibleCells().map(cell => (
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

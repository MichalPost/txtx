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

  const handleClear = () => {
    if (!confirm("确认清空所有下载历史？")) return;
    clearMutation.mutate();
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
              onClick={() => setShowStats(v => !v)}
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
            <Button variant="ghost" size="sm" onClick={handleClear} disabled={total === 0 || clearMutation.isPending}>
              <Trash2 className="w-3.5 h-3.5" /> 清空
            </Button>
          </>
        }
      />

      {showStats && <HistoryStatsPanel onClose={() => setShowStats(false)} />}

      {/* Filter bar */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--color-border)" }}>
          {([["", "全部"], ["success", "成功"], ["error", "失败"]] as [typeof statusFilter, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => { setStatusFilter(v); setPage(1); }}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: statusFilter === v ? "var(--color-accent)" : "var(--color-surface-1)",
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
          >
            <Filter className="w-3 h-3" /> {activeSearch} ✕
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
            <div className="flex flex-col items-center justify-center h-full gap-2 py-16">
              <TableIcon className="w-8 h-8" style={{ color: "var(--color-text-subtle)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {isLoading ? "加载中..." : activeSearch ? "没有匹配的记录" : "暂无历史记录"}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10" style={{ background: "var(--color-surface-1)" }}>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(header => (
                      <th
                        key={header.id}
                        className="text-left px-3 py-2.5 text-xs font-medium"
                        style={{ color: "var(--color-text-muted)", width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    className="group border-t hover:bg-[var(--color-surface-2)] transition-colors"
                    style={{ borderColor: "var(--color-border)" }}
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

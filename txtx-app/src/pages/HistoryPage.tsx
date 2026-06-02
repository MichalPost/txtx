import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper, flexRender,
  getCoreRowModel, useReactTable,
} from "@tanstack/react-table";
import {
  Trash2, RefreshCw, CheckCircle, XCircle, Download,
  BarChart2, TableIcon, ChevronLeft, ChevronRight,
  Search, Filter,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import {
  apiQueryHistory, apiClearHistory, apiGetHistoryStats,
  type HistoryQuery,
} from "@/lib/api";
import { useDownloadStore } from "@/store/downloadStore";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { usePersistedState } from "@/lib/persist";
import type { HistoryEntry } from "@/types";

const PAGE_SIZE = 50;
const PIE_COLORS = [
  "var(--color-accent)", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16",
];

// ─── Stats panel ─────────────────────────────────────────────────────────────

function StatsPanel({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["history-stats", 30],
    queryFn: () => apiGetHistoryStats(30),
  });

  if (isLoading) return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      {[0, 1].map(i => (
        <div key={i} className="h-48 rounded-xl border animate-pulse"
          style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }} />
      ))}
    </div>
  );

  const daily = data?.daily ?? [];
  const sites = data?.sites ?? [];

  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <Card title="近 30 天下载趋势" actions={
        <button onClick={onClose} className="text-xs" style={{ color: "var(--color-text-muted)" }}>收起</button>
      }>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
              <Tooltip
                contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((v: any, name: any) => [v ?? 0, name === "success" ? "成功" : "失败"]) as any}
              />
              <Bar dataKey="success" fill="var(--color-success)" radius={[3,3,0,0]} maxBarSize={20} />
              <Bar dataKey="error" fill="var(--color-danger)" radius={[3,3,0,0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="站点分布（成功）">
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={sites} dataKey="count" nameKey="site" cx="40%" cy="50%"
                outerRadius={60} fontSize={10}>
                {sites.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend formatter={(v: string) => v.replace(/^https?:\/\//, "").slice(0, 12)}
                wrapperStyle={{ fontSize: 10, color: "var(--color-text-muted)" }} />
              <Tooltip
                contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((v: any, name: any) => [v ?? 0, String(name).replace(/^https?:\/\//, "")]) as any}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

// ─── Table columns ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<HistoryEntry>();

// ─── HistoryPage ─────────────────────────────────────────────────────────────

export function HistoryPage() {
  const qc = useQueryClient();
  const { startSingleDownload, phase } = useDownloadStore();
  const isRunning = phase === "scanning" || phase === "downloading";

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "success" | "error">("");
  const [page, setPage] = useState(1);
  const [showStats, setShowStats] = usePersistedState<boolean>("history-show-stats", false);
  const [activeSearch, setActiveSearch] = useState(""); // debounced

  const buildQuery = useCallback((): HistoryQuery => ({
    page,
    page_size: PAGE_SIZE,
    search: activeSearch || undefined,
    status: statusFilter || undefined,
  }), [page, PAGE_SIZE, activeSearch, statusFilter]);

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

  const columns = [
    columnHelper.accessor("status", {
      header: "状态",
      size: 48,
      cell: info => info.getValue() === "success"
        ? <CheckCircle className="w-4 h-4" style={{ color: "var(--color-success)" }} />
        : <XCircle className="w-4 h-4" style={{ color: "var(--color-danger)" }} />,
    }),
    columnHelper.accessor("name", {
      header: "书名",
      cell: info => (
        <span className="font-medium block truncate max-w-[200px]"
          style={{ color: "var(--color-text)" }} title={info.getValue()}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("site", {
      header: "来源站点",
      size: 140,
      cell: info => (
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {info.getValue().replace(/^https?:\/\//, "")}
        </span>
      ),
    }),
    columnHelper.accessor("downloaded_at", {
      header: "下载时间",
      size: 140,
      cell: info => (
        <span className="text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("message", {
      header: "备注",
      cell: info => (
        <span className="text-xs truncate block max-w-[160px]"
          style={{ color: "var(--color-text-muted)" }} title={info.getValue() ?? ""}>
          {info.getValue() ?? "—"}
        </span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "操作",
      size: 72,
      cell: ({ row }) => {
        const e = row.original;
        return e.url ? (
          <button
            onClick={() => handleRedownload(e.url, e.name)}
            disabled={isRunning}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
            style={{
              background: e.status === "error"
                ? "color-mix(in srgb, var(--color-accent) 12%, transparent)"
                : "color-mix(in srgb, var(--color-text-muted) 10%, transparent)",
              color: e.status === "error" ? "var(--color-accent)" : "var(--color-text-muted)",
              cursor: isRunning ? "not-allowed" : "pointer",
            }}
          >
            <Download className="w-3 h-3" />
            {e.status === "error" ? "重下" : "再下"}
          </button>
        ) : null;
      },
    }),
  ];

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
            <Button variant="ghost" size="sm" onClick={handleClear}
              disabled={total === 0 || clearMutation.isPending}>
              <Trash2 className="w-3.5 h-3.5" /> 清空
            </Button>
          </>
        }
      />

      {showStats && <StatsPanel onClose={() => setShowStats(false)} />}

      {/* Filter bar */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--color-border)" }}>
          {([["", "全部"], ["success", "成功"], ["error", "失败"]] as [typeof statusFilter, string][]).map(([v, label]) => (
            <button key={v} onClick={() => { setStatusFilter(v); setPage(1); }}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: statusFilter === v ? "var(--color-accent)" : "var(--color-surface-1)",
                color: statusFilter === v ? "#fff" : "var(--color-text-muted)",
              }}>
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
          <button className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
            style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)", color: "var(--color-accent)" }}
            onClick={() => { setActiveSearch(""); setSearch(""); setPage(1); }}>
            <Filter className="w-3 h-3" /> {activeSearch} ✕
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 rounded-lg text-sm" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          {String(error)}
        </div>
      )}

      <Card className="flex-1 overflow-hidden flex flex-col min-h-0"
        bodyClassName="flex flex-col flex-1 min-h-0 overflow-hidden p-0">
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
                      <th key={header.id}
                        className="text-left px-3 py-2.5 text-xs font-medium"
                        style={{ color: "var(--color-text-muted)", width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id}
                    className="group border-t hover:bg-[var(--color-surface-2)] transition-colors"
                    style={{ borderColor: "var(--color-border)" }}>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t shrink-0"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}>
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              第 {page} / {totalPages} 页，共 {total} 条
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:opacity-80 transition-opacity"
                style={{ color: "var(--color-text-muted)" }}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page - 2 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className="w-7 h-7 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: p === page ? "var(--color-accent)" : "transparent",
                      color: p === page ? "#fff" : "var(--color-text-muted)",
                    }}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:opacity-80 transition-opacity"
                style={{ color: "var(--color-text-muted)" }}>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

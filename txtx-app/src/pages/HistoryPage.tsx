import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, RefreshCw, CheckCircle, XCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { apiGetHistory, apiClearHistory } from "@/lib/api";
import { useDownloadStore } from "@/store/downloadStore";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";

export function HistoryPage() {
  const qc = useQueryClient();
  const { startSingleDownload, phase } = useDownloadStore();
  const isRunning = phase === "scanning" || phase === "downloading";

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ["history"],
    queryFn: apiGetHistory,
    select: (d) => [...d].reverse(),
  });

  const clearMutation = useMutation({
    mutationFn: apiClearHistory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history"] });
      toast.success("历史已清空");
    },
    onError: (e) => toast.error(String(e)),
  });

  const handleClear = () => {
    if (!confirm("确认清空所有下载历史？")) return;
    clearMutation.mutate();
  };

  const handleRedownload = (url: string, name: string) => {
    if (isRunning) {
      toast.error("当前有任务正在运行，请等待完成后再重下");
      return;
    }
    startSingleDownload(url);
    toast.success(`开始重新下载：${name}`);
  };

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">
      <PageHeader
        title="下载历史"
        subtitle={`共 ${data.length} 条记录`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              刷新
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={data.length === 0 || clearMutation.isPending}
            >
              <Trash2 className="w-3.5 h-3.5" /> 清空
            </Button>
          </>
        }
      />

      {error && (
        <div className="px-4 py-2 rounded-lg text-sm" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          {String(error)}
        </div>
      )}

      <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto">
          {data.length === 0 ? (
            <p className="text-xs text-center py-12" style={{ color: "var(--color-text-muted)" }}>
              {isLoading ? "加载中..." : "暂无历史记录"}
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {["状态", "书名", "来源站点", "下载时间", "备注", "操作"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-medium"
                      style={{ color: "var(--color-text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((e, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}
                    className="hover:bg-[var(--color-surface-2)] transition-colors group">
                    <td className="px-3 py-2">
                      {e.status === "success"
                        ? <CheckCircle className="w-4 h-4" style={{ color: "var(--color-success)" }} />
                        : <XCircle className="w-4 h-4" style={{ color: "var(--color-danger)" }} />}
                    </td>
                    <td className="px-3 py-2 font-medium max-w-[200px] truncate"
                      style={{ color: "var(--color-text)" }} title={e.name}>{e.name}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {e.site.replace(/^https?:\/\//, "")}
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {e.downloaded_at}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[160px] truncate"
                      style={{ color: "var(--color-text-muted)" }} title={e.message ?? ""}>
                      {e.message ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {e.url && (
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
                          title={e.status === "error" ? "重新下载" : "再次下载"}
                        >
                          <Download className="w-3 h-3" />
                          {e.status === "error" ? "重下" : "再下"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

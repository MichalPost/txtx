import { useMutation } from "@tanstack/react-query";
import { Activity, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiCheckSites } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";

export function HealthPage() {
  const { mutate: checkSites, data: results = [], isPending: checking, isSuccess } = useMutation({
    mutationFn: apiCheckSites,
    onError: (e) => toast.error(String(e)),
  });

  const reachable = results.filter((r) => r.reachable).length;

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">
      <PageHeader
        title="站点健康检查"
        subtitle={isSuccess ? `${reachable}/${results.length} 个站点可达` : "检查各站点的连通性和响应延迟"}
        actions={
          <Button size="sm" onClick={() => checkSites()} disabled={checking}>
            {checking
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Activity className="w-3.5 h-3.5" />}
            {checking ? "检查中..." : "开始检查"}
          </Button>
        }
      />

      {!isSuccess && !checking && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            点击「开始检查」检测所有启用站点的连通性
          </p>
        </div>
      )}

      {(isSuccess || checking) && (
        <Card className="flex-1 overflow-auto">
          <div className="flex flex-col gap-3">
            {checking && results.length === 0 && (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--color-accent)" }} />
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>正在检查...</span>
              </div>
            )}
            {results.map((r) => (
              <div key={r.domain}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
                style={{
                  background: "var(--color-surface-2)",
                  borderColor: r.reachable ? "var(--color-success)" : "var(--color-danger)",
                }}>
                {r.reachable
                  ? <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "var(--color-success)" }} />
                  : <XCircle className="w-4 h-4 shrink-0" style={{ color: "var(--color-danger)" }} />}
                <span className="flex-1 text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  {r.domain.replace(/^https?:\/\//, "")}
                </span>
                {r.reachable && r.latency_ms != null && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: r.latency_ms < 500 ? "var(--color-success-bg)" : "var(--color-warning-bg)",
                      color: r.latency_ms < 500 ? "var(--color-success)" : "var(--color-warning)",
                    }}>
                    {r.latency_ms} ms
                  </span>
                )}
                {!r.reachable && r.error && (
                  <span className="text-xs max-w-[200px] truncate" style={{ color: "var(--color-danger)" }}
                    title={r.error}>
                    {r.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

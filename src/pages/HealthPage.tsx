import { useMutation } from "@tanstack/react-query";
import { Activity, CheckCircle, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { apiCheckSites } from "@/lib/api";
import { formatToolActionError } from "@/lib/toolActionError";

export function HealthPage() {
  const {
    mutate: checkSites,
    data: results = [],
    isPending: checking,
    isSuccess,
  } = useMutation({
    mutationFn: apiCheckSites,
    onError: (error) => toast.error(formatToolActionError("检查站点健康", error)),
  });

  const reachable = results.filter((r) => r.reachable).length;

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-5">
      <PageHeader
        title="站点健康检查"
        subtitle={
          isSuccess ? `${reachable}/${results.length} 个站点可达` : "检查各站点的连通性和响应延迟"
        }
        actions={
          <Button size="sm" onClick={() => checkSites()} disabled={checking}>
            {checking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Activity className="h-3.5 w-3.5" />
            )}
            {checking ? "检查中..." : "开始检查"}
          </Button>
        }
      />

      {!isSuccess && !checking && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: "var(--color-accent-muted)",
              border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
              boxShadow: "var(--shadow-accent)",
            }}
          >
            <Activity className="h-8 w-8" style={{ color: "var(--color-accent)" }} />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
              还没有检查过
            </p>
            <p className="mt-1.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
              点击「开始检查」测试所有启用站点的连通性
            </p>
          </div>
        </div>
      )}

      {(isSuccess || checking) && (
        <Card className="flex-1 overflow-auto">
          <div className="flex flex-col gap-3">
            {checking && results.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2
                  className="h-4 w-4 animate-spin"
                  style={{ color: "var(--color-accent)" }}
                />
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  正在检查...
                </span>
              </div>
            )}
            {results.map((r) => (
              <div
                key={r.domain}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                style={{
                  background: "var(--color-surface-2)",
                  borderColor: r.reachable ? "var(--color-success)" : "var(--color-danger)",
                }}
              >
                {r.reachable ? (
                  <CheckCircle
                    className="h-4 w-4 shrink-0"
                    style={{ color: "var(--color-success)" }}
                  />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" style={{ color: "var(--color-danger)" }} />
                )}
                <span className="flex-1 text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  {r.domain.replace(/^https?:\/\//, "")}
                </span>
                {r.reachable && r.latency_ms != null && (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{
                      background:
                        r.latency_ms < 500 ? "var(--color-success-bg)" : "var(--color-warning-bg)",
                      color: r.latency_ms < 500 ? "var(--color-success)" : "var(--color-warning)",
                    }}
                  >
                    {r.latency_ms} ms
                  </span>
                )}
                {!r.reachable && r.error && (
                  <span
                    className="max-w-[200px] truncate text-xs"
                    style={{ color: "var(--color-danger)" }}
                    title={r.error}
                  >
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

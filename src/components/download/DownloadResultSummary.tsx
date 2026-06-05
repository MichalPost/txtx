import { useEffect, useRef } from "react";
import {
  CheckCircle, XCircle, AlertCircle, RefreshCw, RotateCcw,
  ListTodo, FolderOpen,
} from "lucide-react";
import { useDownloadStore } from "@/store/downloadStore";
import { useConfigStore } from "@/store/configStore";
import { Button } from "@/components/Button";
import { AnimatedProgressBar } from "@/components/AnimatedProgressBar";
import {
  animateResultCard, animateCountUp, animateCelebration, animateStagger,
} from "@/lib/animations";
import { apiOpenOutputDir } from "@/lib/api";
import { useAppNavigate } from "@/router";

export function DownloadResultSummary() {
  const { novelResults, overallTotal, overallCompleted, reset, retryFailed } = useDownloadStore();
  const { config } = useConfigStore();
  const navigate = useAppNavigate();
  const successCount = novelResults.filter((r) => r.status === "success").length;
  const errorCount = novelResults.filter((r) => r.status === "error").length;
  const errors = novelResults.filter((r) => r.status === "error");

  const containerRef = useRef<HTMLDivElement>(null);
  const successNumRef = useRef<HTMLSpanElement>(null);
  const errorNumRef = useRef<HTMLSpanElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const successCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) animateResultCard(containerRef.current);
    if (successNumRef.current) animateCountUp(successNumRef.current, 0, successCount, 900);
    if (errorNumRef.current) animateCountUp(errorNumRef.current, 0, errorCount, 900);
    if (successCount > 0 && errorCount === 0 && successCardRef.current) {
      setTimeout(() => { if (successCardRef.current) animateCelebration(successCardRef.current); }, 500);
    }
    if (actionsRef.current) {
      const btns = actionsRef.current.querySelectorAll<HTMLElement>("button");
      animateStagger(btns, 80);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenDir = async () => {
    try { await apiOpenOutputDir(); } catch { /* noop in web mode */ }
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-4" style={{ opacity: 0 }}>
      <div className="grid grid-cols-2 gap-3">
        <div
          ref={successCardRef}
          className="flex flex-col items-center gap-1 px-4 py-5 rounded-xl border"
          style={{
            background: "color-mix(in srgb, var(--color-success) 8%, var(--color-surface))",
            borderColor: "var(--color-success)",
          }}
        >
          <CheckCircle className="w-7 h-7" style={{ color: "var(--color-success)" }} />
          <span ref={successNumRef} className="text-3xl font-bold tabular-nums" style={{ color: "var(--color-success)" }}>
            0
          </span>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>下载成功</span>
        </div>
        <div
          className="flex flex-col items-center gap-1 px-4 py-5 rounded-xl border"
          style={{
            background: errorCount > 0
              ? "color-mix(in srgb, var(--color-danger) 8%, var(--color-surface))"
              : "var(--color-surface)",
            borderColor: errorCount > 0 ? "var(--color-danger)" : "var(--color-border)",
          }}
        >
          <XCircle
            className="w-7 h-7"
            style={{ color: errorCount > 0 ? "var(--color-danger)" : "var(--color-text-subtle)" }}
          />
          <span
            ref={errorNumRef}
            className="text-3xl font-bold tabular-nums"
            style={{ color: errorCount > 0 ? "var(--color-danger)" : "var(--color-text-muted)" }}
          >
            0
          </span>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>下载失败</span>
        </div>
      </div>

      {overallTotal > 0 && (
        <div
          className="px-4 py-3 rounded-xl border"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <div className="flex justify-between text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
            <span>总体完成率</span>
            <span className="tabular-nums font-medium" style={{ color: "var(--color-text)" }}>
              {overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0}%
            </span>
          </div>
          <AnimatedProgressBar value={overallCompleted} total={overallTotal} color="var(--color-success)" />
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
          <div
            className="px-4 py-2.5 text-xs font-semibold border-b"
            style={{
              background: "var(--color-surface-1)",
              borderColor: "var(--color-border)",
              color: "var(--color-danger)",
            }}
          >
            失败列表
          </div>
          <div className="max-h-40 overflow-y-auto">
            {errors.map((e) => (
              <div
                key={e.name}
                className="flex items-start gap-2 px-4 py-2 border-b last:border-0 text-xs"
                style={{ borderColor: "var(--color-border)" }}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--color-danger)" }} />
                <div className="min-w-0">
                  <p className="font-medium truncate" style={{ color: "var(--color-text)" }}>{e.name}</p>
                  {e.message && (
                    <p className="truncate" style={{ color: "var(--color-text-muted)" }}>{e.message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={actionsRef} className="flex flex-col gap-2">
        {errorCount > 0 && (
          <Button
            size="sm"
            className="w-full"
            onClick={retryFailed}
            style={{ background: "var(--color-warning)", color: "#fff", border: "none" }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> 重试失败 ({errorCount})
          </Button>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={reset}>
            <RotateCcw className="w-3.5 h-3.5" /> 重置
          </Button>
          <Button size="sm" className="flex-1" onClick={() => { reset(); navigate("/"); }}>
            <ListTodo className="w-3.5 h-3.5" /> 返回任务发起台
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate("/tasks")}>
          <ListTodo className="w-3.5 h-3.5" /> 去任务管理
        </Button>
        {config?.paths.base_dir && (
          <Button variant="ghost" size="sm" className="w-full" onClick={handleOpenDir}>
            <FolderOpen className="w-3.5 h-3.5" /> 打开输出目录
          </Button>
        )}
      </div>
    </div>
  );
}

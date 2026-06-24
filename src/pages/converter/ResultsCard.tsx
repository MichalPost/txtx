import { CheckCircle, XCircle } from "lucide-react";

import { Card } from "@/components/Card";

import { summarizeConvertResults } from "./converterUtils";
import type { ConvertResult } from "./types";

export function ResultsCard({
  title,
  emptyTitle,
  emptyDescription,
  results,
  running,
  runningLabel,
}: {
  title?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  results: ConvertResult[];
  running: boolean;
  runningLabel?: string;
}) {
  const summary = summarizeConvertResults(results);

  return (
    <Card title={title ?? "转换结果"} className="flex min-h-0 w-full shrink-0 flex-col xl:w-80">
      {!running && results.length === 0 && (
        <div
          className="mb-3 rounded-xl border border-dashed px-4 py-5 text-center text-xs"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-surface-2)",
            color: "var(--color-text-muted)",
          }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
            {emptyTitle ?? "还没有结果"}
          </p>
          <p className="mt-1.5 leading-relaxed">
            {emptyDescription ?? "开始执行后，这里会显示成功和失败结果。"}
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <span
            className="rounded-full px-2.5 py-1"
            style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
          >
            共 {summary.total} 项
          </span>
          <span
            className="rounded-full px-2.5 py-1"
            style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
          >
            成功 {summary.success}
          </span>
          {summary.failed > 0 && (
            <span
              className="rounded-full px-2.5 py-1"
              style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
            >
              失败 {summary.failed}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {running && results.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2"
              style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-accent)" }}
            />
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {runningLabel ?? "处理中..."}
            </p>
          </div>
        )}
        {results.map((result, index) => (
          <div key={index} className="flex items-start gap-2 text-xs">
            {result.ok ? (
              <CheckCircle
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                style={{ color: "var(--color-success)" }}
              />
            ) : (
              <XCircle
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                style={{ color: "var(--color-danger)" }}
              />
            )}
            <div>
              <p
                className="max-w-[220px] truncate font-medium"
                style={{ color: "var(--color-text)" }}
                title={result.path}
              >
                {result.path.split(/[/\\]/).pop()}
              </p>
              <p style={{ color: result.ok ? "var(--color-text-muted)" : "var(--color-danger)" }}>
                {result.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

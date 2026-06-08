import { CheckCircle, XCircle } from "lucide-react";

import { Card } from "@/components/Card";

import type { ConvertResult } from "./types";

export function ResultsCard({
  results,
  running,
}: {
  results: ConvertResult[];
  running: boolean;
}) {
  return (
    <Card title="转换结果" className="flex min-h-0 w-80 shrink-0 flex-col">
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {running && results.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2"
              style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-accent)" }}
            />
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              转换中...
            </p>
          </div>
        )}
        {results.map((r, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            {r.ok ? (
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
                title={r.path}
              >
                {r.path.split(/[/\\]/).pop()}
              </p>
              <p style={{ color: r.ok ? "var(--color-text-muted)" : "var(--color-danger)" }}>
                {r.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

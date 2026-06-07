import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/Button";
import type { TaskRecord } from "@/types";

export function FailedView({ task, onRetry }: { task: TaskRecord; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
      <AlertCircle className="h-10 w-10" style={{ color: "var(--color-danger)" }} />
      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        任务失败
      </p>
      {task.error_message && (
        <pre
          className="max-h-32 w-full max-w-full overflow-auto rounded-lg px-3 py-2 text-left text-xs break-words whitespace-pre-wrap"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          {task.error_message}
        </pre>
      )}
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RotateCcw className="h-3.5 w-3.5" /> 重试
      </Button>
    </div>
  );
}

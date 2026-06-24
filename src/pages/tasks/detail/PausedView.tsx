import { PauseCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/Button";
import type { TaskRecord } from "@/types";

import { getTaskRetryAction } from "./taskDetailUtils";

export function PausedView({
  task,
  onContinue,
  retryPending = false,
}: {
  task: TaskRecord;
  onContinue: () => void;
  retryPending?: boolean;
}) {
  const action = getTaskRetryAction(task);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background: "var(--color-warning-bg)",
          border: "1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)",
        }}
      >
        <PauseCircle className="h-7 w-7" style={{ color: "var(--color-warning)" }} />
      </div>
      <div className="max-w-md">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          任务已暂停
        </p>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          暂停会停止当前 worker。继续时会根据已保存的来源信息创建一个新任务，原暂停记录会保留，方便回看。
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={onContinue}
        disabled={retryPending || !action.canRun}
        title={action.canRun ? action.idleLabel : action.unavailableReason}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {retryPending ? action.pendingLabel : action.idleLabel}
      </Button>
      {!action.canRun && (
        <p className="max-w-sm text-xs" style={{ color: "var(--color-danger)" }}>
          {action.unavailableReason}
        </p>
      )}
    </div>
  );
}

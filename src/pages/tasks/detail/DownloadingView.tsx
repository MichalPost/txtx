import { AnimatedProgressBar } from "@/components/AnimatedProgressBar";
import type { TaskRecord } from "@/types";

import { CounterPair } from "./CounterPair";
import { TaskStats } from "./TaskStats";

export function DownloadingView({ task }: { task: TaskRecord }) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {task.total > 0 && (
        <div className="flex flex-col gap-1.5">
          <div
            className="flex justify-between text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            <span>总进度</span>
            <span>
              {task.completed}/{task.total}
            </span>
          </div>
          <AnimatedProgressBar value={task.completed} total={task.total} />
        </div>
      )}
      {(task.stats ?? task.scan_stats) && <TaskStats stats={(task.stats ?? task.scan_stats)!} />}
      <CounterPair success={task.success_count} error={task.error_count} />
    </div>
  );
}

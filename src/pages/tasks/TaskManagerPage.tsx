import { useEffect } from "react";
import { toast } from "sonner";

import { formatTaskCreateError } from "@/lib/taskCreateFeedback";
import { useTaskStore } from "@/store/taskStore";
import type { ScanTaskOptions } from "@/types";

import { TaskDetailPanel } from "./TaskDetailPanel";
import { TaskListPanel } from "./TaskListPanel";

export function TaskManagerPage() {
  const { init, createScanTask, createBatchTask, createSingleTask } = useTaskStore();

  useEffect(() => {
    init();
  }, [init]);

  const handleNewScan = async (opts: ScanTaskOptions) => {
    try {
      await createScanTask(opts);
    } catch (e) {
      toast.error(formatTaskCreateError("scan", e));
      throw e;
    }
  };

  const handleNewBatch = async (opts: ScanTaskOptions) => {
    try {
      await createBatchTask(opts);
    } catch (e) {
      toast.error(formatTaskCreateError("batch", e));
      throw e;
    }
  };

  const handleNewSingle = async (url: string) => {
    try {
      await createSingleTask(url);
    } catch (e) {
      toast.error(formatTaskCreateError("single", e));
      throw e;
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: task list — fixed width */}
      <div
        className="flex w-72 shrink-0 flex-col overflow-hidden border-r"
        style={{ borderColor: "var(--color-border)" }}
      >
        <TaskListPanel
          onNewScan={handleNewScan}
          onNewBatch={handleNewBatch}
          onNewSingle={handleNewSingle}
        />
      </div>

      {/* Right: task detail */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TaskDetailPanel />
      </div>
    </div>
  );
}

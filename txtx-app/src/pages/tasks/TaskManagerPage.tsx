import { useEffect } from "react";
import { useTaskStore } from "@/store/taskStore";
import { TaskListPanel } from "./TaskListPanel";
import { TaskDetailPanel } from "./TaskDetailPanel";
import type { ScanTaskOptions } from "@/types";

export function TaskManagerPage() {
  const { init, createScanTask, createBatchTask, createSingleTask } = useTaskStore();

  useEffect(() => {
    init();
  }, [init]);

  const handleNewScan = async (opts: ScanTaskOptions) => {
    try {
      await createScanTask(opts);
    } catch (e) {
      console.error("创建扫描任务失败:", e);
    }
  };

  const handleNewBatch = async (opts: ScanTaskOptions) => {
    try {
      await createBatchTask(opts);
    } catch (e) {
      console.error("创建批量下载任务失败:", e);
    }
  };

  const handleNewSingle = async (url: string) => {
    try {
      await createSingleTask(url);
    } catch (e) {
      console.error("创建单本下载任务失败:", e);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: task list — fixed width */}
      <div className="w-64 shrink-0 overflow-hidden flex flex-col">
        <TaskListPanel
          onNewScan={handleNewScan}
          onNewBatch={handleNewBatch}
          onNewSingle={handleNewSingle}
        />
      </div>

      {/* Right: task detail */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <TaskDetailPanel />
      </div>
    </div>
  );
}

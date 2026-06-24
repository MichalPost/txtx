import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { formatTaskCreateError } from "@/lib/taskCreateFeedback";
import { formatTaskInitError } from "@/lib/taskInitError";
import { useTaskStore } from "@/store/taskStore";
import type { ScanTaskOptions } from "@/types";

import { TaskDetailPanel } from "./TaskDetailPanel";
import { TaskListPanel } from "./TaskListPanel";

export function TaskManagerPage() {
  const {
    init,
    createScanTask,
    createBatchTask,
    createSingleTask,
    activeTaskId,
    pollError,
    pollErrorVersion,
  } = useTaskStore();
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    void init().catch((error) => {
      setInitError(formatTaskInitError(error));
      toast.error(formatTaskInitError(error));
    });
  }, [init]);

  useEffect(() => {
    if (!pollError) return;
    toast.error(`任务列表自动刷新失败：${pollError}`);
  }, [pollError, pollErrorVersion]);

  useEffect(() => {
    if (activeTaskId) {
      setMobileView("detail");
    }
  }, [activeTaskId]);

  const handleNewScan = async (opts: ScanTaskOptions) => {
    try {
      setInitError(null);
      await createScanTask(opts);
    } catch (e) {
      toast.error(formatTaskCreateError("scan", e));
      throw e;
    }
  };

  const handleNewBatch = async (opts: ScanTaskOptions) => {
    try {
      setInitError(null);
      await createBatchTask(opts);
    } catch (e) {
      toast.error(formatTaskCreateError("batch", e));
      throw e;
    }
  };

  const handleNewSingle = async (url: string) => {
    try {
      setInitError(null);
      await createSingleTask(url);
    } catch (e) {
      toast.error(formatTaskCreateError("single", e));
      throw e;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
      {initError ? (
        <div
          className="mx-3 mt-3 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm md:absolute md:top-0 md:right-0 md:left-0 md:z-10"
          style={{
            background: "var(--color-danger-bg)",
            borderColor: "color-mix(in srgb, var(--color-danger) 25%, transparent)",
            color: "var(--color-danger)",
          }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">任务中心初始化失败</p>
            <p className="mt-1 text-xs">{initError}</p>
          </div>
          <button
            type="button"
            className="rounded-md border px-3 py-1.5 text-xs transition-opacity hover:opacity-80"
            style={{ borderColor: "currentColor" }}
            onClick={() => {
              setInitError(null);
              void init().catch((error) => {
                const message = formatTaskInitError(error);
                setInitError(message);
                toast.error(message);
              });
            }}
          >
            重试加载
          </button>
        </div>
      ) : null}
      <div
        className="flex shrink-0 gap-2 border-b px-3 py-2 md:hidden"
        style={{ borderColor: "var(--color-border)" }}
      >
        <button
          type="button"
          className="flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
          style={{
            borderColor: mobileView === "list" ? "var(--color-accent)" : "var(--color-border)",
            color: mobileView === "list" ? "var(--color-accent)" : "var(--color-text-muted)",
            backgroundColor:
              mobileView === "list" ? "color-mix(in srgb, var(--color-accent) 10%, transparent)" : "transparent",
          }}
          onClick={() => setMobileView("list")}
        >
          任务列表
        </button>
        <button
          type="button"
          className="flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
          style={{
            borderColor:
              mobileView === "detail" ? "var(--color-accent)" : "var(--color-border)",
            color: mobileView === "detail" ? "var(--color-accent)" : "var(--color-text-muted)",
            backgroundColor:
              mobileView === "detail"
                ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
                : "transparent",
          }}
          onClick={() => setMobileView("detail")}
        >
          {activeTaskId ? "任务详情" : "空态预览"}
        </button>
      </div>

      {/* Left: task list — fixed width */}
      <div
        className={[
          "min-h-0 flex-1 flex-col overflow-hidden md:flex md:w-72 md:shrink-0 md:flex-none md:border-r",
          mobileView === "list" ? "flex" : "hidden",
        ].join(" ")}
        style={{ borderColor: "var(--color-border)" }}
      >
        <TaskListPanel
          onNewScan={handleNewScan}
          onNewBatch={handleNewBatch}
          onNewSingle={handleNewSingle}
        />
      </div>

      {/* Right: task detail */}
      <div
        className={[
          "min-h-0 flex-1 flex-col overflow-hidden",
          mobileView === "detail" ? "flex" : "hidden",
          "md:flex",
        ].join(" ")}
      >
        <TaskDetailPanel onBackToList={() => setMobileView("list")} />
      </div>
    </div>
  );
}

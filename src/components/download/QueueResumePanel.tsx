import { useEffect, useRef } from "react";
import { ListTodo, RefreshCw, XCircle } from "lucide-react";

import { Button } from "@/components/Button";
import { animateFadeInUp } from "@/lib/animations";
import { useAppNavigate } from "@/router";
import { useDownloadStore } from "@/store/downloadStore";
import { useTaskStore } from "@/store/taskStore";

export function QueueResumePanel() {
  const { queueStatus, loadQueueStatus, clearQueueFile } = useDownloadStore();
  const { tasks, setActive } = useTaskStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useAppNavigate();

  useEffect(() => {
    void loadQueueStatus();
    // loadQueueStatus is a stable zustand action reference, intentionally omitted from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (queueStatus?.exists && panelRef.current) {
      animateFadeInUp(panelRef.current);
    }
  }, [queueStatus?.exists]);

  if (!queueStatus?.exists) return null;

  const q = queueStatus;

  const handleGoToTasks = () => {
    // Try to auto-select the most recent active task so the user lands on it directly
    const activeTask = tasks.find(
      (t) => t.status === "scanning" || t.status === "downloading" || t.status === "paused",
    );
    if (activeTask) setActive(activeTask.id);
    navigate("/tasks");
  };

  return (
    <div
      ref={panelRef}
      className="flex shrink-0 flex-col gap-2 rounded-xl border px-4 py-3"
      style={{
        opacity: 0,
        background: "color-mix(in srgb, var(--color-warning) 8%, var(--color-surface))",
        borderColor: "var(--color-warning)",
      }}
    >
      <div className="flex items-center gap-3">
        <RefreshCw className="h-4 w-4 shrink-0" style={{ color: "var(--color-warning)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
            上次下载没有完成
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {q.item_count} 本 · 目标日期 {q.target_date} · 创建于 {q.created_at}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" size="sm" onClick={clearQueueFile}>
            <XCircle className="h-3.5 w-3.5" /> 清除
          </Button>
          <Button
            size="sm"
            onClick={handleGoToTasks}
            style={{ background: "var(--color-warning)", color: "#fff", border: "none" }}
          >
            <ListTodo className="h-3.5 w-3.5" /> 去任务管理
          </Button>
        </div>
      </div>
      {/* Resume explanation */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
        style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
      >
        <RefreshCw className="h-3 w-3 shrink-0" />
        <span>
          新建下载任务时会自动从断点恢复——已下载的章节将跳过，只补下缺失部分。
          如不需要续传，点"清除"后重新发起。
        </span>
      </div>
    </div>
  );
}

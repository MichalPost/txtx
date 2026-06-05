import { useEffect, useRef } from "react";
import { RefreshCw, XCircle, ListTodo } from "lucide-react";
import { useDownloadStore } from "@/store/downloadStore";
import { Button } from "@/components/Button";
import { animateFadeInUp } from "@/lib/animations";
import { useAppNavigate } from "@/router";

export function QueueResumePanel() {
  const { queueStatus, loadQueueStatus, clearQueueFile } = useDownloadStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useAppNavigate();

  useEffect(() => {
    loadQueueStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (queueStatus?.exists && panelRef.current) {
      animateFadeInUp(panelRef.current);
    }
  }, [queueStatus?.exists]);

  if (!queueStatus?.exists) return null;

  const q = queueStatus;

  return (
    <div
      ref={panelRef}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border shrink-0"
      style={{
        opacity: 0,
        background: "color-mix(in srgb, var(--color-warning) 8%, var(--color-surface))",
        borderColor: "var(--color-warning)",
      }}
    >
      <RefreshCw className="w-4 h-4 shrink-0" style={{ color: "var(--color-warning)" }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
          上次下载没有完成
        </p>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {q.item_count} 本 · 目标日期 {q.target_date} · 创建于 {q.created_at}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={clearQueueFile}>
          <XCircle className="w-3.5 h-3.5" /> 清除
        </Button>
        <Button
          size="sm"
          onClick={() => navigate("/tasks")}
          style={{ background: "var(--color-warning)", color: "#fff", border: "none" }}
        >
          <ListTodo className="w-3.5 h-3.5" /> 去任务管理
        </Button>
      </div>
    </div>
  );
}

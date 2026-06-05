import { useEffect, useState } from "react";
import { ScanSearch, FileUp, ListTodo, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useDownloadStore } from "@/store/downloadStore";
import { useTaskStore } from "@/store/taskStore";
import { useConfigStore } from "@/store/configStore";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { SingleDownloadInput } from "@/components/download/SingleDownloadInput";
import { ImportUrlPanel } from "@/components/download/ImportUrlPanel";
import { QueueResumePanel } from "@/components/download/QueueResumePanel";
import { IdlePanel } from "@/components/download/IdlePanel";
import { useAppNavigate } from "@/router";

// ─── Main page ────────────────────────────────────────────────────────────────

export function DownloadPage() {
  const { config } = useConfigStore();
  const { phase } = useDownloadStore();
  const { init: initTasks, createSingleTask, createScanTask, setActive } = useTaskStore();
  const [showImport, setShowImport] = useState(false);
  const navigate = useAppNavigate();

  useEffect(() => {
    void initTasks();
  }, [initTasks]);

  const isRunning = phase === "scanning" || phase === "downloading";

  const handleCreateScanTask = async () => {
    const opts = useDownloadStore.getState().scanOptions;
    const taskId = await createScanTask(Object.keys(opts).length > 0 ? opts : undefined);
    setActive(taskId);
    toast.success("已创建扫描任务，请在任务管理确认书单并开始下载");
    navigate("/tasks");
  };

  // Header right-side controls
  const headerActions = (
    <>
      <Button variant="secondary" size="sm" onClick={() => navigate("/tasks")}>
        <ListTodo className="w-3.5 h-3.5" /> 查看任务
      </Button>
      {!isRunning && (
        <Button size="sm" onClick={() => { void handleCreateScanTask(); }} disabled={!config}>
          <ScanSearch className="w-3.5 h-3.5" /> 新建扫描任务
        </Button>
      )}
    </>
  );

  return (
    <div className="flex flex-col h-full gap-0 overflow-hidden">
      {/* ── Header region ────────────────────────────────────────────── */}
      <div className="px-5 pt-5 shrink-0">
        <PageHeader
          title="任务发起台"
          subtitle={
            config?.paths.base_dir
              ? `从这里发起扫描和下载任务，后续进度在任务管理查看；保存目录：${config.paths.base_dir}`
              : "从这里发起扫描和下载任务，后续进度在任务管理查看"
          }
          actions={headerActions}
        />
      </div>

      {/* ── Resume queue (idle only) ─────────────────────────────────── */}
      {phase === "idle" && (
        <div className="px-5 mt-4 shrink-0">
          <QueueResumePanel />
        </div>
      )}

      <div className="px-5 mt-4 shrink-0 flex flex-col gap-2">
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <SingleDownloadInput
              disabled={isRunning}
              onSubmit={async (url) => {
                await createSingleTask(url);
                toast.success("已创建单本下载任务，请在任务管理查看进度");
              }}
            />
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setShowImport((v) => !v)}
            disabled={isRunning}
            title="批量导入 URL"
          >
            <FileUp className="w-4 h-4" />
            批量导入
          </Button>
        </div>
        {showImport && (
          <ImportUrlPanel
            onClose={() => setShowImport(false)}
            onImport={async (urls) => {
              if (urls.length === 1) {
                await createSingleTask(urls[0]);
                toast.success("已创建单本下载任务，请在任务管理查看进度");
              } else {
                for (const url of urls) {
                  try {
                    await createSingleTask(url);
                  } catch (e) {
                    console.error("创建任务失败:", url, e);
                  }
                }
                toast.success(`已创建 ${urls.length} 个下载任务，请前往「任务管理」查看`);
              }
              setShowImport(false);
            }}
          />
        )}
      </div>

      {/* ── Main content area ────────────────────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0 px-5 mt-4 pb-5">
        {phase === "idle" ? (
          <IdlePanel
            onScan={handleCreateScanTask}
            disabled={!config}
            taskMode
          />
        ) : (
          <div
            className="flex-1 flex flex-col items-center justify-center gap-5 rounded-2xl border px-6 py-8 text-center"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "var(--color-accent-muted)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
                boxShadow: "var(--shadow-accent)",
              }}
            >
              <ListTodo className="w-8 h-8" style={{ color: "var(--color-accent)" }} />
            </div>
            <div className="flex flex-col gap-2 max-w-lg">
              <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
                当前任务已经转到任务管理
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                扫描中、待确认、下载中和完成后的日志，都统一在任务管理里查看和操作。
                首页现在主要负责发起新任务。
              </p>
            </div>
            <Button size="lg" onClick={() => navigate("/tasks")}>
              <ListTodo className="w-4 h-4" />
              前往任务管理
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

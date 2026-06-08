import { useEffect, useState } from "react";
import { Activity, ArrowRight, FileUp, Globe, ListTodo, ScanSearch } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { IdlePanel } from "@/components/download/IdlePanel";
import { ImportUrlPanel } from "@/components/download/ImportUrlPanel";
import { PreflightPanel } from "@/components/download/PreflightPanel";
import { QueueResumePanel } from "@/components/download/QueueResumePanel";
import { SingleDownloadInput } from "@/components/download/SingleDownloadInput";
import { PageHeader } from "@/components/PageHeader";
import { useAppNavigate } from "@/router";
import { useConfigStore } from "@/store/configStore";
import { useDownloadStore } from "@/store/downloadStore";
import { useTaskStore } from "@/store/taskStore";

// ─── Main page ────────────────────────────────────────────────────────────────

export function DownloadPage() {
  const { config } = useConfigStore();
  const { phase } = useDownloadStore();
  const { init: initTasks, createSingleTask, createScanTask, setActive } = useTaskStore();
  const [showImport, setShowImport] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
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
        <ListTodo className="h-3.5 w-3.5" /> 查看任务
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowPreflight((v) => !v)}
        title="下载前检测站点可达性"
      >
        <Activity className="h-3.5 w-3.5" /> 预检站点
      </Button>
      {!isRunning && (
        <Button
          size="sm"
          onClick={() => {
            void handleCreateScanTask();
          }}
          disabled={!config}
        >
          <ScanSearch className="h-3.5 w-3.5" /> 新建扫描任务
        </Button>
      )}
    </>
  );

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden">
      {/* ── Header region ────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-5">
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
        <div className="mt-4 shrink-0 px-5">
          <QueueResumePanel />
        </div>
      )}

      {/* ── Preflight panel ──────────────────────────────────────────── */}
      {showPreflight && (
        <div className="mt-3 shrink-0 px-5">
          <PreflightPanel
            onDismiss={() => setShowPreflight(false)}
            onConfirm={() => {
              setShowPreflight(false);
              void handleCreateScanTask();
            }}
          />
        </div>
      )}

      <div className="mt-4 flex shrink-0 flex-col gap-2 px-5">
        <div className="flex items-center gap-2">
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
            <FileUp className="h-4 w-4" />
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
                let successCount = 0;
                const failedUrls: string[] = [];
                for (const url of urls) {
                  try {
                    await createSingleTask(url);
                    successCount++;
                  } catch (e) {
                    console.error("创建任务失败:", url, e);
                    failedUrls.push(url);
                  }
                }
                if (failedUrls.length > 0) {
                  toast.error(`${failedUrls.length} 个任务创建失败，已成功创建 ${successCount} 个`);
                } else {
                  toast.success(`已创建 ${successCount} 个下载任务，请前往「任务管理」查看`);
                }
              }
              setShowImport(false);
            }}
          />
        )}
      </div>

      {/* ── Main content area ────────────────────────────────────────── */}
      <div className="mt-4 flex min-h-0 flex-1 gap-4 px-5 pb-5">
        {phase === "idle" && config && Object.keys(config.websites).length === 0 ? (
          /* No sites configured yet — show onboarding nudge */
          <div
            className="flex flex-1 flex-col items-center justify-center gap-5 rounded-2xl border px-6 py-12 text-center"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "var(--color-accent-muted)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
                boxShadow: "var(--shadow-accent)",
              }}
            >
              <Globe className="h-8 w-8" style={{ color: "var(--color-accent)" }} />
            </div>
            <div className="flex max-w-sm flex-col gap-2">
              <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
                还没有配置站点
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                先去网站配置页面添加一个站点，设置好规则就能开始下载。
              </p>
            </div>
            <Button size="md" onClick={() => navigate("/rules")}>
              <Globe className="h-4 w-4" /> 去配置站点
            </Button>
          </div>
        ) : phase === "idle" ? (
          <IdlePanel onScan={handleCreateScanTask} disabled={!config} taskMode />
        ) : (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-5 rounded-2xl border px-6 py-8 text-center"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "var(--color-accent-muted)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
                boxShadow: "var(--shadow-accent)",
              }}
            >
              <ListTodo className="h-8 w-8" style={{ color: "var(--color-accent)" }} />
            </div>
            <div className="flex max-w-lg flex-col gap-2">
              <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
                当前任务已经转到任务管理
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                扫描中、待确认、下载中和完成后的日志，都统一在任务管理里查看和操作。
                首页现在主要负责发起新任务。
              </p>
            </div>
            <Button size="lg" onClick={() => navigate("/tasks")}>
              <ListTodo className="h-4 w-4" />
              前往任务管理
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

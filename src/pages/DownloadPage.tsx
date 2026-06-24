import { Suspense, lazy, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  FileUp,
  Globe,
  ListTodo,
  Loader2,
  RefreshCw,
  ScanSearch,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { formatBatchImportResult } from "@/components/download/downloadTaskFeedback";
import { IdlePanel } from "@/components/download/IdlePanel";
import { QueueResumePanel } from "@/components/download/QueueResumePanel";
import { SingleDownloadInput } from "@/components/download/SingleDownloadInput";
import { PageHeader } from "@/components/PageHeader";
import { buildDownloadOverview } from "@/pages/downloadPageUtils";
import { formatTaskCreateError, formatTaskCreateSuccess } from "@/lib/taskCreateFeedback";
import { formatTaskInitError } from "@/lib/taskInitError";
import { createTasksFromUrls } from "@/lib/taskSubmission";
import { useAppNavigate } from "@/router";
import { useConfigStore } from "@/store/configStore";
import { useDownloadStore } from "@/store/downloadStore";
import { useTaskStore } from "@/store/taskStore";
import { hasManagedTask, hasRunningTask } from "@/store/taskStoreUtils";

const ImportUrlPanel = lazy(async () => {
  const mod = await import("@/components/download/ImportUrlPanel");
  return { default: mod.ImportUrlPanel };
});

const PreflightPanel = lazy(async () => {
  const mod = await import("@/components/download/PreflightPanel");
  return { default: mod.PreflightPanel };
});

export function DownloadPage() {
  const { config, error: configError, loading: configLoading, loadConfig } = useConfigStore();
  const { init: initTasks, createSingleTask, createScanTask, tasks, setActive } = useTaskStore();
  const [showImport, setShowImport] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);
  const navigate = useAppNavigate();

  useEffect(() => {
    void initTasks().catch((error) => {
      toast.error(formatTaskInitError(error));
    });
  }, [initTasks]);

  const isRunning = hasRunningTask(tasks);
  const hasOpenManagedTask = hasManagedTask(tasks);
  const overview = buildDownloadOverview({ tasks, config, configError });
  const enabledSiteDomains = config
    ? Object.values(config.websites)
        .filter((site) => site.enabled)
        .map((site) => site.domain_name)
    : [];
  const selectedSiteDomains = useDownloadStore.getState().scanOptions.enabled_sites ?? null;

  const runTaskSubmission = async <T,>(action: () => Promise<T>) => {
    if (submittingTask) return null;
    setSubmittingTask(true);
    try {
      return await action();
    } finally {
      setSubmittingTask(false);
    }
  };

  const focusTaskAndOpenManager = (taskId: string | null) => {
    if (!taskId) return;
    setActive(taskId);
    navigate("/tasks");
  };

  const handleCreateScanTask = async () => {
    return runTaskSubmission(async () => {
      try {
        const opts = useDownloadStore.getState().scanOptions;
        const taskId = await createScanTask(Object.keys(opts).length > 0 ? opts : undefined);
        focusTaskAndOpenManager(taskId);
        toast.success(formatTaskCreateSuccess("scan"));
        return taskId;
      } catch (error) {
        toast.error(formatTaskCreateError("scan", error));
        throw error;
      }
    });
  };

  const headerActions = (
    <>
      <Button variant="secondary" size="sm" onClick={() => navigate("/tasks")}>
        <ListTodo className="h-3.5 w-3.5" /> 查看任务
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowPreflight((v) => !v)}
        disabled={submittingTask || Boolean(configError) || !config}
        title={configError || !config ? "请先恢复站点配置后再做下载前预检" : "下载前检测站点可达性"}
      >
        <Activity className="h-3.5 w-3.5" /> 预检站点
      </Button>
      {!hasOpenManagedTask && (
        <Button size="sm" onClick={() => void handleCreateScanTask()} disabled={!config || submittingTask}>
          {submittingTask ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ScanSearch className="h-3.5 w-3.5" />
          )}{" "}
          {submittingTask ? "创建中..." : "新建扫描任务"}
        </Button>
      )}
    </>
  );

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden">
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

      {!hasOpenManagedTask && (
        <div className="mt-4 shrink-0 px-5">
          <QueueResumePanel />
        </div>
      )}

      {showPreflight && (
        <div className="mt-3 shrink-0 px-5">
          <Suspense
            fallback={
              <div
                className="rounded-xl border px-4 py-3 text-sm"
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
                正在加载预检面板...
              </div>
            }
          >
            <PreflightPanel
              onDismiss={() => setShowPreflight(false)}
              selectedSites={selectedSiteDomains}
              enabledSites={enabledSiteDomains}
              onConfirm={async () => {
                setShowPreflight(false);
                await handleCreateScanTask();
              }}
            />
          </Suspense>
        </div>
      )}

      <div className="mt-4 flex shrink-0 flex-col gap-2 px-5">
        <div
          className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              {overview.primaryMessage}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              {overview.secondaryMessage}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {overview.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-full px-2.5 py-1 text-xs"
                  style={{
                    background:
                      stat.tone === "danger"
                        ? "var(--color-danger-bg)"
                        : stat.tone === "accent"
                          ? "var(--color-accent-muted)"
                          : stat.tone === "warning"
                            ? "var(--color-warning-bg)"
                            : "var(--color-surface-2)",
                    color:
                      stat.tone === "danger"
                        ? "var(--color-danger)"
                        : stat.tone === "accent"
                          ? "var(--color-accent)"
                          : stat.tone === "warning"
                            ? "var(--color-warning)"
                            : "var(--color-text-muted)",
                  }}
                >
                  {stat.label} {stat.value}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-end justify-start md:justify-end">
            <Button
              variant={configError ? "secondary" : "ghost"}
              size="sm"
              onClick={() => navigate(configError || !config ? "/rules" : "/tasks")}
            >
              <ListTodo className="h-3.5 w-3.5" />
              {overview.ctaLabel}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1 min-w-0">
            <SingleDownloadInput
              disabled={isRunning || submittingTask}
              onSubmit={async (url) => {
                await runTaskSubmission(async () => {
                  const taskId = await createSingleTask(url);
                  toast.success(formatTaskCreateSuccess("single"));
                  focusTaskAndOpenManager(taskId);
                });
              }}
            />
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setShowImport((v) => !v)}
            disabled={isRunning || submittingTask}
            title="批量导入 URL"
            className="w-full sm:w-auto"
          >
            <FileUp className="h-4 w-4" />
            批量导入
          </Button>
        </div>
        {showImport && (
          <Suspense
            fallback={
              <div
                className="rounded-xl border px-4 py-3 text-sm"
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
                正在加载导入面板...
              </div>
            }
          >
            <ImportUrlPanel
              taskMode
              onClose={() => setShowImport(false)}
              onImport={async (urls, importSummary) => {
                await runTaskSubmission(async () => {
                  let latestTaskId: string | null = null;
                  const requestedCount = urls.length;
                  if (urls.length === 1) {
                    latestTaskId = await createSingleTask(urls[0]);
                    toast.success(formatTaskCreateSuccess("single"));
                    focusTaskAndOpenManager(latestTaskId);
                    return;
                  }

                  const beforeIds = new Set(tasks.map((task) => task.id));
                  const result = await createTasksFromUrls(urls, async (nextUrl) => {
                    const taskId = await createSingleTask(nextUrl);
                    latestTaskId = taskId;
                  });
                  if (result.failures.length > 0) {
                    toast.error(
                      formatBatchImportResult({
                        requestedCount,
                        successCount: result.successCount,
                        failureCount: result.failures.length,
                        duplicateCount: importSummary.duplicateCount,
                        invalidCount: importSummary.invalidCount,
                      }),
                    );
                    if (result.successCount === 0) {
                      throw new Error("所有任务创建都失败了，请检查 URL 或后端状态后重试");
                    }
                  } else {
                    toast.success(
                      formatBatchImportResult({
                        requestedCount,
                        successCount: result.successCount,
                        failureCount: 0,
                        duplicateCount: importSummary.duplicateCount,
                        invalidCount: importSummary.invalidCount,
                      }) || formatTaskCreateSuccess("multi_single", result.successCount),
                    );
                  }
                  if (!latestTaskId) {
                    latestTaskId =
                      useTaskStore
                        .getState()
                        .tasks.find((task) => !beforeIds.has(task.id) && task.kind === "single_download")
                        ?.id ?? null;
                  }
                  focusTaskAndOpenManager(latestTaskId);
                });
              }}
            />
          </Suspense>
        )}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 gap-4 px-5 pb-5">
        {configError ? (
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
                background: "var(--color-danger-bg)",
                border: "1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)",
              }}
            >
              <AlertCircle className="h-8 w-8" style={{ color: "var(--color-danger)" }} />
            </div>
            <div className="flex max-w-md flex-col gap-2">
              <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
                站点配置暂时没有加载成功
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                当前无法判断可用站点，也不能安全地发起扫描任务。请先重试加载配置；如果问题持续，再检查后端服务或配置文件状态。
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--color-danger)" }}>
                {configError}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="md" onClick={() => void loadConfig({ force: true })} disabled={configLoading}>
                <RefreshCw className={`h-4 w-4${configLoading ? " animate-spin" : ""}`} />
                {configLoading ? "重试中..." : "重新加载配置"}
              </Button>
              <Button variant="secondary" size="md" onClick={() => navigate("/rules")}>
                <Globe className="h-4 w-4" /> 去规则管理检查
              </Button>
            </div>
          </div>
        ) : !hasOpenManagedTask && config && Object.keys(config.websites).length === 0 ? (
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
        ) : !hasOpenManagedTask ? (
          <IdlePanel onScan={() => void handleCreateScanTask()} disabled={!config || submittingTask} taskMode />
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

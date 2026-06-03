import { useState } from "react";
import { Square, RotateCcw, ScanSearch, Pause, FileUp } from "lucide-react";
import { toast } from "sonner";
import { useDownloadStore } from "@/store/downloadStore";
import { useTaskStore } from "@/store/taskStore";
import { useConfigStore } from "@/store/configStore";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { StepIndicator } from "@/components/download/StepIndicator";
import { ScanningPanel } from "@/components/download/ScanningPanel";
import { DownloadProgress } from "@/components/download/DownloadProgress";
import { ScanPreview } from "@/components/download/ScanPreview";
import { SingleDownloadInput } from "@/components/download/SingleDownloadInput";
import { ImportUrlPanel } from "@/components/download/ImportUrlPanel";
import { QueueResumePanel } from "@/components/download/QueueResumePanel";
import { IdlePanel } from "@/components/download/IdlePanel";
import { LogPanel } from "@/components/download/LogPanel";

// ─── Phase config ─────────────────────────────────────────────────────────────

const phaseLabel: Record<string, string> = {
  idle: "就绪",
  scanning: "扫描中",
  preview: "待确认",
  downloading: "下载中",
  done: "完成",
  stopped: "已停止",
};

const phaseColor: Record<string, string> = {
  idle: "var(--color-text-subtle)",
  scanning: "var(--color-warning)",
  preview: "var(--color-accent)",
  downloading: "var(--color-accent)",
  done: "var(--color-success)",
  stopped: "var(--color-text-subtle)",
};

const phaseDotBg: Record<string, string> = {
  idle: "var(--color-border)",
  scanning: "var(--color-warning)",
  preview: "var(--color-accent)",
  downloading: "var(--color-accent)",
  done: "var(--color-success)",
  stopped: "var(--color-border)",
};

// ─── Main page ────────────────────────────────────────────────────────────────

export function DownloadPage() {
  const { config } = useConfigStore();
  const { phase, startScan, startSingleDownload, stopDownload, pauseDownload, reset } = useDownloadStore();
  const { createSingleTask } = useTaskStore();
  const [showImport, setShowImport] = useState(false);

  const isRunning = phase === "scanning" || phase === "downloading";
  const isPreview = phase === "preview";
  const showLeftPanel =
    phase === "scanning" || phase === "downloading" || phase === "done" || phase === "stopped";

  // Header right-side controls
  const headerActions = (
    <>
      {isRunning && (
        <div className="flex gap-2">
          {phase === "downloading" && (
            <Button variant="secondary" size="sm" onClick={pauseDownload}>
              <Pause className="w-3.5 h-3.5" /> 暂停
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={stopDownload}>
            <Square className="w-3.5 h-3.5" /> 停止
          </Button>
        </div>
      )}
      {!isRunning && !isPreview && phase !== "done" && phase !== "stopped" && (
        <Button size="sm" onClick={() => { reset(); startScan(); }} disabled={!config}>
          <ScanSearch className="w-3.5 h-3.5" /> 开始扫描
        </Button>
      )}
      {(phase === "done" || phase === "stopped") && (
        <Button variant="secondary" size="sm" onClick={reset}>
          <RotateCcw className="w-3.5 h-3.5" /> 重置
        </Button>
      )}
    </>
  );

  return (
    <div className="flex flex-col h-full gap-0 overflow-hidden">
      {/* ── Header region ────────────────────────────────────────────── */}
      <div className="px-5 pt-5 shrink-0">
        <PageHeader
          title="下载控制台"
          subtitle={config?.paths.base_dir ? `保存目录：${config.paths.base_dir}` : undefined}
          actions={headerActions}
        />
      </div>

      {/* ── Status bar (step indicator + phase label) ────────────────── */}
      {phase !== "idle" && (
        <div
          className="mx-5 mt-4 px-4 py-2 rounded-xl flex items-center gap-3 shrink-0"
          style={{
            background: "var(--color-surface-1)",
            border: "1px solid var(--color-border)",
          }}
        >
          <StepIndicator phase={phase} />
          <div className="ml-auto flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: phaseDotBg[phase] }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: phaseColor[phase] }}
            >
              {phaseLabel[phase]}
            </span>
          </div>
        </div>
      )}

      {/* ── Resume queue (idle only) ─────────────────────────────────── */}
      {phase === "idle" && (
        <div className="px-5 mt-4 shrink-0">
          <QueueResumePanel />
        </div>
      )}

      {/* ── Single-URL input + batch import (not in preview) ────────── */}
      {!isPreview && (
        <div className="px-5 mt-4 shrink-0 flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <SingleDownloadInput disabled={isRunning} />
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
                  reset();
                  startSingleDownload(urls[0]);
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
      )}

      {/* ── Main content area ────────────────────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0 px-5 mt-4 pb-5">
        {isPreview ? (
          <>
            <div className="flex-1 min-h-0 flex flex-col min-w-0">
              <ScanPreview />
            </div>
            <div className="w-52 shrink-0">
              <LogPanel />
            </div>
          </>
        ) : (
          <>
            {showLeftPanel && (
              <div className="w-80 shrink-0 overflow-y-auto">
                {phase === "scanning" ? <ScanningPanel /> : <DownloadProgress />}
              </div>
            )}
            {phase === "idle" && (
              <IdlePanel onScan={() => { reset(); startScan(); }} disabled={!config} />
            )}
            {phase !== "idle" && (
              <div className="flex-1 flex flex-col min-h-0">
                <LogPanel />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

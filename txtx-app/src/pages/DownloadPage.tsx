import { Square, RotateCcw, ScanSearch, Pause } from "lucide-react";
import { useDownloadStore } from "@/store/downloadStore";
import { useConfigStore } from "@/store/configStore";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { StepIndicator } from "@/components/download/StepIndicator";
import { ScanningPanel } from "@/components/download/ScanningPanel";
import { DownloadProgress } from "@/components/download/DownloadProgress";
import { ScanPreview } from "@/components/download/ScanPreview";
import { SingleDownloadInput } from "@/components/download/SingleDownloadInput";
import { QueueResumePanel } from "@/components/download/QueueResumePanel";
import { IdlePanel } from "@/components/download/IdlePanel";
import { LogPanel } from "@/components/download/LogPanel";

// ─── Phase labels ─────────────────────────────────────────────────────────────

const phaseLabel: Record<string, string> = {
  idle: "就绪", scanning: "扫描中", preview: "待确认",
  downloading: "下载中", done: "完成", stopped: "已停止",
};
const phaseColor: Record<string, string> = {
  idle: "var(--color-text-muted)", scanning: "var(--color-warning)",
  preview: "var(--color-accent)", downloading: "var(--color-accent)",
  done: "var(--color-success)", stopped: "var(--color-text-muted)",
};

// ─── Main page ────────────────────────────────────────────────────────────────

export function DownloadPage() {
  const { config } = useConfigStore();
  const { phase, startScan, stopDownload, pauseDownload, reset } = useDownloadStore();

  const isRunning = phase === "scanning" || phase === "downloading";
  const isPreview = phase === "preview";
  const showLeftPanel = phase === "scanning" || phase === "downloading" || phase === "done" || phase === "stopped";

  return (
    <div className="flex flex-col h-full gap-4 p-5 overflow-hidden">
      <PageHeader
        title="下载控制台"
        subtitle={`保存目录：${config?.paths.base_dir ?? "—"}`}
        actions={
          <>
            <StepIndicator phase={phase} />
            <span className="text-sm font-medium" style={{ color: phaseColor[phase] }}>
              {phaseLabel[phase]}
            </span>
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
        }
      />

      {phase === "idle" && <QueueResumePanel />}

      {!isPreview && (
        <div className="shrink-0">
          <SingleDownloadInput disabled={isRunning} />
        </div>
      )}

      {isPreview ? (
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="flex-1 min-h-0 flex flex-col"><ScanPreview /></div>
          <div className="w-64 shrink-0"><LogPanel /></div>
        </div>
      ) : (
        <div className="flex gap-4 flex-1 min-h-0">
          {showLeftPanel && (
            <div className="w-72 shrink-0 overflow-y-auto">
              {phase === "scanning" ? <ScanningPanel /> : <DownloadProgress />}
            </div>
          )}
          {phase === "idle" && (
            <IdlePanel onScan={() => { reset(); startScan(); }} disabled={!config} />
          )}
          {phase !== "idle" && (
            <div className="flex-1 flex flex-col min-h-0"><LogPanel /></div>
          )}
        </div>
      )}
    </div>
  );
}

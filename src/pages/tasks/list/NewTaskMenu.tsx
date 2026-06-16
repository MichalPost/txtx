import { useState } from "react";
import { Download, FileUp, Link, ScanSearch } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { ImportUrlPanel } from "@/components/download/ImportUrlPanel";
import { Input } from "@/components/Input";
import { formatTaskCreateSuccess } from "@/lib/taskCreateFeedback";
import { createTasksFromUrls, submitTaskAndThen } from "@/lib/taskSubmission";
import { useSchedulerStore } from "@/store/schedulerStore";
import type { DownloadMode, ScanTaskOptions } from "@/types";

import { DailyScheduler } from "./DailyScheduler";
import { DownloadModeSelector } from "./DownloadModeSelector";

interface NewTaskMenuProps {
  onNewScan: (opts: ScanTaskOptions) => void;
  onNewBatch: (opts: ScanTaskOptions) => void;
  onNewSingle: (url: string) => void;
  onClose: () => void;
}

export function NewTaskMenu({ onNewScan, onNewBatch, onNewSingle, onClose }: NewTaskMenuProps) {
  const [singleUrl, setSingleUrl] = useState("");
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [downloadMode, setDownloadMode] = useState<DownloadMode>("smart");

  const {
    enabled: schedEnabled,
    hour: schedHour,
    toggle: schedToggle,
    setHour: schedSetHour,
  } = useSchedulerStore();

  const modeOpts: ScanTaskOptions = { download_mode: downloadMode };

  return (
    <div
      className="flex shrink-0 flex-col gap-3 border-b p-3"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
    >
      {/* Daily scheduler */}
      <DailyScheduler
        enabled={schedEnabled}
        hour={schedHour}
        onToggle={schedToggle}
        onSetHour={schedSetHour}
      />

      <div className="h-px" style={{ background: "var(--color-border)" }} />

      {/* Download mode selector */}
      <DownloadModeSelector value={downloadMode} onChange={setDownloadMode} />

      {/* Divider */}
      <div className="h-px" style={{ background: "var(--color-border)" }} />

      {/* Task type buttons */}
      <div className="flex flex-col gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          className="justify-start"
          onClick={() => {
            void submitTaskAndThen(
              () => Promise.resolve(onNewScan(modeOpts)),
              onClose,
            );
          }}
        >
          <ScanSearch className="h-3.5 w-3.5" /> 扫描预览
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="justify-start"
          onClick={() => {
            void submitTaskAndThen(
              () => Promise.resolve(onNewBatch(modeOpts)),
              onClose,
            );
          }}
        >
          <Download className="h-3.5 w-3.5" /> 批量下载
        </Button>
        <div className="flex gap-1">
          <Input
            className="h-7 flex-1 text-xs"
            placeholder="输入小说 URL..."
            value={singleUrl}
            onChange={(e) => setSingleUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && singleUrl.trim()) {
                void submitTaskAndThen(
                  () => Promise.resolve(onNewSingle(singleUrl.trim())),
                  () => {
                    setSingleUrl("");
                    onClose();
                  },
                );
              }
            }}
          />
          <Button
            size="sm"
            disabled={!singleUrl.trim()}
            onClick={() => {
              if (singleUrl.trim()) {
                void submitTaskAndThen(
                  () => Promise.resolve(onNewSingle(singleUrl.trim())),
                  () => {
                    setSingleUrl("");
                    onClose();
                  },
                );
              }
            }}
          >
            <Link className="h-3 w-3" />
          </Button>
        </div>

        {/* Import from file */}
        <button
          className="flex w-full items-center gap-1.5 rounded-lg border px-3 py-1.5 text-left text-xs font-medium transition-opacity hover:opacity-80"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-muted)",
          }}
          onClick={() => setShowImportPanel((v) => !v)}
        >
          <FileUp className="h-3.5 w-3.5" />
          从文件批量导入
        </button>
        {showImportPanel && (
          <ImportUrlPanel
            taskMode
            onClose={() => setShowImportPanel(false)}
            onImport={async (urls) => {
              const result = await createTasksFromUrls(urls, (url) =>
                Promise.resolve(onNewSingle(url)),
              );
              if (result.failures.length > 0) {
                toast.error(
                  `${result.failures.length} 个任务创建失败，已成功创建 ${result.successCount} 个`,
                );
              } else if (result.successCount > 0) {
                toast.success(formatTaskCreateSuccess("multi_single", result.successCount));
              }
              if (result.successCount > 0) {
                setShowImportPanel(false);
                onClose();
                return;
              }
              throw new Error("所有任务创建都失败了，请检查 URL 或后端状态后重试");
            }}
          />
        )}
      </div>
    </div>
  );
}

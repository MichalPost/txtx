import { useState } from "react";
import { Download, FileUp, Link, ScanSearch } from "lucide-react";

import { Button } from "@/components/Button";
import { ImportUrlPanel } from "@/components/download/ImportUrlPanel";
import { Input } from "@/components/Input";
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
            onNewScan(modeOpts);
            onClose();
          }}
        >
          <ScanSearch className="h-3.5 w-3.5" /> 扫描预览
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="justify-start"
          onClick={() => {
            onNewBatch(modeOpts);
            onClose();
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
                onNewSingle(singleUrl.trim());
                setSingleUrl("");
                onClose();
              }
            }}
          />
          <Button
            size="sm"
            disabled={!singleUrl.trim()}
            onClick={() => {
              if (singleUrl.trim()) {
                onNewSingle(singleUrl.trim());
                setSingleUrl("");
                onClose();
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
              for (const url of urls) {
                try {
                  await onNewSingle(url);
                } catch (e) {
                  console.error("创建任务失败:", url, e);
                }
              }
              setShowImportPanel(false);
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

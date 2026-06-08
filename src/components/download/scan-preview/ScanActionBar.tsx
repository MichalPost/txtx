import { ArrowRight, Download } from "lucide-react";

import { Button } from "@/components/Button";

export function ScanActionBar({
  selectedCount,
  pendingCount,
  selectedCountRef,
  onGoTasks,
  onStartDownload,
}: {
  selectedCount: number;
  pendingCount: number;
  selectedCountRef: React.RefObject<HTMLSpanElement | null>;
  onGoTasks: () => void;
  onStartDownload: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between pt-1">
      <div className="flex items-center gap-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
        <span>
          已选{" "}
          <span
            ref={selectedCountRef}
            className="font-semibold"
            style={{ color: "var(--color-accent)" }}
          >
            {selectedCount}
          </span>{" "}
          本
        </span>
        {selectedCount > pendingCount && (
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{
              background: "color-mix(in srgb, var(--color-warning) 12%, transparent)",
              color: "var(--color-warning)",
            }}
          >
            含 {selectedCount - pendingCount} 本强制加入
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onGoTasks}>
          <ArrowRight className="h-3.5 w-3.5" /> 去任务管理
        </Button>
        <Button size="sm" onClick={onStartDownload} disabled={selectedCount === 0}>
          <Download className="h-3.5 w-3.5" /> 开始下载{" "}
          {selectedCount > 0 ? `(${selectedCount})` : ""}
        </Button>
      </div>
    </div>
  );
}

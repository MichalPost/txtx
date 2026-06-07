import { FileJson, FileText } from "lucide-react";

import type { ScanItem } from "@/types";

import { exportCsv, exportJson } from "./exportUtils";

export function ExportDropdown({
  scanItems,
  selectedUrls,
  onClose,
}: {
  scanItems: ScanItem[];
  selectedUrls: Set<string>;
  onClose: () => void;
}) {
  type ExportItem = { label: string; fn: () => void; icon: typeof FileText };
  const items: ExportItem[] = [
    { label: "导出全部 CSV", fn: () => exportCsv(scanItems, false, selectedUrls), icon: FileText },
    { label: "导出已选 CSV", fn: () => exportCsv(scanItems, true, selectedUrls), icon: FileText },
    {
      label: "导出全部 JSON",
      fn: () => exportJson(scanItems, false, selectedUrls),
      icon: FileJson,
    },
    { label: "导出已选 JSON", fn: () => exportJson(scanItems, true, selectedUrls), icon: FileJson },
  ];
  return (
    <div
      className="absolute top-full right-0 z-50 mt-1 overflow-hidden rounded-lg border shadow-lg"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      {items.map(({ label, fn, icon: Icon }) => (
        <button
          key={label}
          onClick={() => {
            fn();
            onClose();
          }}
          className="flex w-full items-center gap-2 border-b px-4 py-2 text-left text-xs transition-opacity last:border-0 hover:opacity-80"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
          {label}
        </button>
      ))}
    </div>
  );
}

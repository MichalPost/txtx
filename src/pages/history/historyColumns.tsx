import { createColumnHelper } from "@tanstack/react-table";
import { CheckCircle, XCircle, Download } from "lucide-react";
import type { HistoryEntry } from "@/types";

const columnHelper = createColumnHelper<HistoryEntry>();

interface ColumnOptions {
  isRunning: boolean;
  onRedownload: (url: string, name: string) => void;
}

export function buildHistoryColumns({ isRunning, onRedownload }: ColumnOptions) {
  return [
    columnHelper.accessor("status", {
      header: "状态",
      size: 48,
      cell: info =>
        info.getValue() === "success"
          ? <CheckCircle className="w-4 h-4" style={{ color: "var(--color-success)" }} />
          : <XCircle className="w-4 h-4" style={{ color: "var(--color-danger)" }} />,
    }),
    columnHelper.accessor("name", {
      header: "书名",
      cell: info => (
        <span
          className="font-medium block truncate max-w-[200px]"
          style={{ color: "var(--color-text)" }}
          title={info.getValue()}
        >
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("site", {
      header: "来源站点",
      size: 140,
      cell: info => (
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {info.getValue().replace(/^https?:\/\//, "")}
        </span>
      ),
    }),
    columnHelper.accessor("downloaded_at", {
      header: "下载时间",
      size: 140,
      cell: info => (
        <span className="text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("message", {
      header: "备注",
      cell: info => (
        <span
          className="text-xs truncate block max-w-[160px]"
          style={{ color: "var(--color-text-muted)" }}
          title={info.getValue() ?? ""}
        >
          {info.getValue() ?? "—"}
        </span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "操作",
      size: 72,
      cell: ({ row }) => {
        const e = row.original;
        if (!e.url) return null;
        return (
          <button
            onClick={() => onRedownload(e.url, e.name)}
            disabled={isRunning}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
            style={{
              background: e.status === "error"
                ? "color-mix(in srgb, var(--color-accent) 12%, transparent)"
                : "color-mix(in srgb, var(--color-text-muted) 10%, transparent)",
              color: e.status === "error" ? "var(--color-accent)" : "var(--color-text-muted)",
              cursor: isRunning ? "not-allowed" : "pointer",
            }}
          >
            <Download className="w-3 h-3" />
            {e.status === "error" ? "重下" : "再下"}
          </button>
        );
      },
    }),
  ];
}

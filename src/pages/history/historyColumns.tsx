import { createColumnHelper } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle, Download, XCircle } from "lucide-react";

import type { HistorySortField, HistorySortOrder } from "@/lib/api";
import type { HistoryEntry } from "@/types";

const columnHelper = createColumnHelper<HistoryEntry>();

interface ColumnOptions {
  isRunning: boolean;
  onRedownload: (url: string, name: string) => void;
  isSelected?: (entry: HistoryEntry) => boolean;
  onSelect?: (entry: HistoryEntry, checked: boolean) => void;
  sortBy: HistorySortField;
  sortOrder: HistorySortOrder;
  onSortChange: (field: HistorySortField) => void;
}

function buildSortableHeader(
  label: string,
  field: HistorySortField,
  activeSort: { sortBy: HistorySortField; sortOrder: HistorySortOrder },
  onSortChange: (field: HistorySortField) => void,
) {
  const isActive = activeSort.sortBy === field;
  const Icon = !isActive ? ArrowUpDown : activeSort.sortOrder === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={() => onSortChange(field)}
      className="inline-flex items-center gap-1 transition-colors hover:opacity-80"
      style={{ color: isActive ? "var(--color-text)" : "var(--color-text-muted)" }}
      aria-label={`按${label}排序`}
    >
      <span>{label}</span>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export function buildHistoryColumns({
  isRunning,
  onRedownload,
  isSelected,
  onSelect,
  sortBy,
  sortOrder,
  onSortChange,
}: ColumnOptions) {
  const activeSort = { sortBy, sortOrder };

  return [
    columnHelper.display({
      id: "select",
      header: "",
      size: 36,
      cell: ({ row }) => {
        const entry = row.original;
        if (entry.status !== "error" || !entry.url) return null;

        return (
          <input
            type="checkbox"
            checked={isSelected?.(entry) ?? false}
            onChange={(event) => onSelect?.(entry, event.target.checked)}
            disabled={isRunning}
            aria-label={`选择重下 ${entry.name}`}
          />
        );
      },
    }),
    columnHelper.accessor("status", {
      header: () => buildSortableHeader("状态", "status", activeSort, onSortChange),
      size: 48,
      cell: (info) =>
        info.getValue() === "success" ? (
          <CheckCircle className="h-4 w-4" style={{ color: "var(--color-success)" }} />
        ) : (
          <XCircle className="h-4 w-4" style={{ color: "var(--color-danger)" }} />
        ),
    }),
    columnHelper.accessor("name", {
      header: () => buildSortableHeader("书名", "name", activeSort, onSortChange),
      cell: (info) => (
        <span
          className="block max-w-[200px] truncate font-medium"
          style={{ color: "var(--color-text)" }}
          title={info.getValue()}
        >
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("site", {
      header: () => buildSortableHeader("来源站点", "site", activeSort, onSortChange),
      size: 140,
      cell: (info) => (
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {info.getValue().replace(/^https?:\/\//, "")}
        </span>
      ),
    }),
    columnHelper.accessor("downloaded_at", {
      header: () => buildSortableHeader("下载时间", "downloaded_at", activeSort, onSortChange),
      size: 140,
      cell: (info) => (
        <span className="text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("message", {
      header: "备注",
      cell: (info) => (
        <span
          className="block max-w-[160px] truncate text-xs"
          style={{ color: "var(--color-text-muted)" }}
          title={info.getValue() ?? ""}
        >
          {info.getValue() ?? ""}
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
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            style={{
              background:
                e.status === "error"
                  ? "color-mix(in srgb, var(--color-accent) 12%, transparent)"
                  : "color-mix(in srgb, var(--color-text-muted) 10%, transparent)",
              color: e.status === "error" ? "var(--color-accent)" : "var(--color-text-muted)",
              cursor: isRunning ? "not-allowed" : "pointer",
            }}
          >
            <Download className="h-3 w-3" />
            {e.status === "error" ? "重下" : "再下"}
          </button>
        );
      },
    }),
  ];
}

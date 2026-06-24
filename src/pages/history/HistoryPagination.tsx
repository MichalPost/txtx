import { ChevronLeft, ChevronRight } from "lucide-react";

import { buildVisiblePages } from "./historyPaginationUtils";

interface HistoryPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function HistoryPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: HistoryPaginationProps) {
  if (totalPages <= 1) return null;

  const visiblePages = buildVisiblePages(page, totalPages, 5);

  return (
    <div
      className="flex shrink-0 flex-col gap-2 border-t px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
    >
      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        第 {page} / {totalPages} 页，共 {total} 条
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id="history-page-size"
          name="history-page-size"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-7 rounded-lg border px-2 text-xs"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-muted)",
          }}
          aria-label="每页条数"
        >
          {[50, 100, 200].map((size) => (
            <option key={size} value={size}>
              {size} / 页
            </option>
          ))}
        </select>
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded-lg p-1.5 transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ color: "var(--color-text-muted)" }}
          aria-label="上一页"
          title="上一页"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="rounded-lg p-1.5 transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ color: "var(--color-text-muted)" }}
          aria-label="第一页"
          title="第一页"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {visiblePages.map((p) => {
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className="h-7 w-7 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: p === page ? "var(--color-accent)" : "transparent",
                color: p === page ? "#fff" : "var(--color-text-muted)",
              }}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="rounded-lg p-1.5 transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ color: "var(--color-text-muted)" }}
          aria-label="下一页"
          title="下一页"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="rounded-lg p-1.5 transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ color: "var(--color-text-muted)" }}
          aria-label="最后一页"
          title="最后一页"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

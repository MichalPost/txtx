import { ChevronLeft, ChevronRight } from "lucide-react";

interface HistoryPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function HistoryPagination({
  page,
  totalPages,
  total,
  onPageChange,
}: HistoryPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div
      className="flex shrink-0 items-center justify-between border-t px-4 py-2.5"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
    >
      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        第 {page} / {totalPages} 页，共 {total} 条
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="rounded-lg p-1.5 transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ color: "var(--color-text-muted)" }}
          aria-label="第一页"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = page <= 3 ? i + 1 : page - 2 + i;
          if (p < 1 || p > totalPages) return null;
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
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="rounded-lg p-1.5 transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

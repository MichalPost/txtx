import { ChevronLeft, ChevronRight } from "lucide-react";

interface HistoryPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function HistoryPagination({ page, totalPages, total, onPageChange }: HistoryPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 border-t shrink-0"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
    >
      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        第 {page} / {totalPages} 页，共 {total} 条
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg disabled:opacity-40 hover:opacity-80 transition-opacity"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = page <= 3 ? i + 1 : page - 2 + i;
          if (p < 1 || p > totalPages) return null;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className="w-7 h-7 rounded-lg text-xs font-medium transition-colors"
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
          className="p-1.5 rounded-lg disabled:opacity-40 hover:opacity-80 transition-opacity"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/Button";

interface BookPageControlsProps {
  currentPage: number;
  pageTotal: number;
  pageUrl: string;
  loading: boolean;
  onFetchPage: (pageIndex: number) => void;
}

export function BookPageControls({
  currentPage,
  pageTotal,
  pageUrl,
  loading,
  onFetchPage,
}: BookPageControlsProps) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-3 py-2"
      style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
    >
      <span className="flex-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
        第 {currentPage} / {pageTotal} 页
        {currentPage > 1 && (
          <span className="ml-1.5 font-mono text-[10px]" style={{ color: "var(--color-text-subtle)" }}>
            {pageUrl}
          </span>
        )}
      </span>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onFetchPage(currentPage - 1)}
        disabled={currentPage <= 1 || loading}
      >
        <ChevronLeft className="h-3 w-3" />
        上一页
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onFetchPage(currentPage + 1)}
        disabled={currentPage >= pageTotal || loading}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        下一页
      </Button>
      {currentPage > 1 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onFetchPage(1)}
          disabled={loading}
          title="回到第一页"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

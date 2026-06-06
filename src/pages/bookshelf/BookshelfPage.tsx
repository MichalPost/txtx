import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, Search, ArrowUp, ArrowDown, FolderOpen, Trash2, RefreshCw, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useConfigStore } from "@/store/configStore";
import { apiListBooks, apiDeleteBook, apiOpenBook } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";

type SortKey = "name" | "size" | "modified";
type SortDir = "asc" | "desc";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function BookshelfPage() {
  const { config } = useConfigStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("modified");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const baseDir = config?.paths.base_dir ?? "";

  const { data: books = [], isLoading, error, refetch } = useQuery({
    queryKey: ["books", baseDir],
    queryFn: () => apiListBooks(baseDir),
    enabled: !!baseDir,
  });

  const deleteMutation = useMutation({
    mutationFn: apiDeleteBook,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books"] });
      toast.success("已删除");
      setConfirmDelete(null);
    },
    onError: (e) => toast.error(String(e)),
  });

  const filtered = useMemo(() => {
    let list = [...books];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b => b.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, "zh");
      if (sortKey === "size") cmp = a.size - b.size;
      if (sortKey === "modified") cmp = a.modified.localeCompare(b.modified);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [books, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => {
    const isActive = sortKey === k;
    const Icon = sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        onClick={() => toggleSort(k)}
        className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors"
        style={{
          color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
          background: isActive
            ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
            : "transparent",
        }}
      >
        {label}
        {isActive && <Icon className="w-3 h-3" />}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">
      <PageHeader
        title="本地书架"
        subtitle={books.length > 0 ? `共 ${filtered.length} 本${search ? ` / ${books.length} 本` : ""}` : "浏览已下载的书目"}
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refetch()} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
            placeholder="搜索书名..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs mr-1" style={{ color: "var(--color-text-subtle)" }}>排序：</span>
          <SortBtn k="name" label="名称" />
          <SortBtn k="size" label="大小" />
          <SortBtn k="modified" label="时间" />
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          {String(error)}
        </div>
      )}

      {/* Book list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>加载中...</p>
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "var(--color-accent-muted)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
                boxShadow: "var(--shadow-accent)",
              }}
            >
              <BookOpen className="w-8 h-8" style={{ color: "var(--color-accent)" }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                {search ? "没有匹配的书目" : "书架是空的"}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                {search ? "试试其他关键词" : `下载目录: ${baseDir || "未设置（请先在设置中配置）"}`}
              </p>
            </div>
          </div>
        )}
        {filtered.map(book => (
          <div
            key={book.path}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: "var(--color-accent-muted)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)",
              }}
            >
              <FileText className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                {book.name}
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {formatSize(book.size)} · {formatDate(book.modified)} · {book.extension.toUpperCase()}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => apiOpenBook(book.path).catch(e => toast.error(String(e)))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors hover:opacity-80"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-muted)",
                  background: "var(--color-surface-2)",
                }}
                title="打开文件"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                打开
              </button>
              {confirmDelete === book.path ? (
                <div className="flex items-center gap-1.5 ml-1">
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>确认删除？</span>
                  <button
                    onClick={() => deleteMutation.mutate(book.path)}
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{ background: "var(--color-danger)", color: "#fff" }}
                  >
                    删除
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-2 py-1 rounded text-xs border"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(book.path)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:opacity-80"
                  style={{ color: "var(--color-danger)" }}
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

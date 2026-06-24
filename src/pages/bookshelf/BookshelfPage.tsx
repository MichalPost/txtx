import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { filesize } from "filesize";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CircleAlert,
  Download,
  FileText,
  FolderOpen,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { ChapterQualityReport } from "@/components/download/ChapterQualityReport";
import { PageHeader } from "@/components/PageHeader";
import {
  apiDeleteBook,
  apiListBooks,
  apiOpenBook,
  apiOpenBookParent,
  apiOpenOutputDir,
  apiSaveTextFile,
} from "@/lib/api";
import { formatToolActionError } from "@/lib/toolActionError";
import { readLocalTextFile } from "@/platform/filesystem";
import { PLATFORM_CAPABILITIES } from "@/platform/runtime";
import { useAppNavigate } from "@/router";
import { useConfigStore } from "@/store/configStore";
import type { BookFile } from "@/types";

import {
  buildBookshelfSelectionSummary,
  buildBookshelfSummary,
  filterAndSortBooks,
  getAvailableExtensions,
  reconcileBookshelfSelection,
  setVisibleBookshelfSelection,
  toggleBookshelfPathSelection,
  type BookshelfSortDir,
  type BookshelfSortKey,
} from "./bookshelfListUtils";
import { buildChapterQualityExportText, buildChapterQualitySummary } from "./bookshelfQualityUtils";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

const EMPTY_BOOKS: BookFile[] = [];

function arePathSetsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  if (a.size !== b.size) return false;
  for (const path of a) {
    if (!b.has(path)) return false;
  }
  return true;
}

export function BookshelfPage() {
  const { config, loading: configLoading, error: configError, loadConfig } = useConfigStore();
  const qc = useQueryClient();
  const navigate = useAppNavigate();
  const [search, setSearch] = useState("");
  const [extensionFilter, setExtensionFilter] = useState("all");
  const [sortKey, setSortKey] = useState<BookshelfSortKey>("modified");
  const [sortDir, setSortDir] = useState<BookshelfSortDir>("desc");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [openingBook, setOpeningBook] = useState<string | null>(null);
  const [openingParent, setOpeningParent] = useState<string | null>(null);
  const [openingShelfDir, setOpeningShelfDir] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [qualityReport, setQualityReport] = useState<{ book: BookFile; content: string } | null>(
    null,
  );
  const [checkingQuality, setCheckingQuality] = useState<string | null>(null);
  const [exportingQuality, setExportingQuality] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const baseDir = config?.paths.base_dir ?? "";

  const {
    data: books = EMPTY_BOOKS,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["books", baseDir],
    queryFn: () => apiListBooks(baseDir),
    enabled: !!baseDir,
  });

  const deleteMutation = useMutation({
    mutationFn: apiDeleteBook,
    onSuccess: (_result, path) => {
      qc.invalidateQueries({ queryKey: ["books"] });
      toast.success("已删除");
      setConfirmDelete(null);
      setSelectedPaths((current) => {
        const next = new Set(current);
        next.delete(path);
        return next;
      });
    },
    onError: (error) => toast.error(formatToolActionError("删除书籍", error)),
  });

  const extensions = useMemo(() => getAvailableExtensions(books), [books]);
  const filtered = useMemo(
    () =>
      filterAndSortBooks(books, {
        search,
        extension: extensionFilter,
        sortKey,
        sortDir,
      }),
    [books, extensionFilter, search, sortDir, sortKey],
  );
  const summary = useMemo(() => buildBookshelfSummary(books, filtered), [books, filtered]);
  const selectionSummary = useMemo(
    () => buildBookshelfSelectionSummary(selectedPaths, filtered),
    [filtered, selectedPaths],
  );
  const selectedVisiblePaths = useMemo(
    () => filtered.filter((book) => selectedPaths.has(book.path)).map((book) => book.path),
    [filtered, selectedPaths],
  );
  const hasFilters = search.trim().length > 0 || extensionFilter !== "all";
  const hasBaseDir = baseDir.trim().length > 0;

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 124,
    overscan: 8,
  });

  const toggleSort = (key: BookshelfSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleRefresh = async () => {
    const result = await refetch();
    if (result.error) {
      toast.error(formatToolActionError("刷新书架", result.error));
    } else {
      toast.success("书架已刷新");
    }
  };

  const toggleBookSelection = (path: string) => {
    setConfirmBulkDelete(false);
    setSelectedPaths((current) => toggleBookshelfPathSelection(current, path));
  };

  const toggleVisibleSelection = () => {
    setConfirmBulkDelete(false);
    setSelectedPaths(
      setVisibleBookshelfSelection(filtered, !selectionSummary.allVisibleSelected),
    );
  };

  const clearSelection = () => {
    setConfirmBulkDelete(false);
    setSelectedPaths(new Set());
  };

  const handleOpenBook = async (path: string) => {
    if (openingBook === path) return;
    setOpeningBook(path);
    try {
      await apiOpenBook(path);
    } catch (error) {
      toast.error(formatToolActionError("打开文件", error));
    } finally {
      setOpeningBook(null);
    }
  };

  const handleOpenBookParent = async (path: string) => {
    if (openingParent === path) return;
    setOpeningParent(path);
    try {
      await apiOpenBookParent(path);
    } catch (error) {
      toast.error(formatToolActionError("打开所在目录", error));
    } finally {
      setOpeningParent(null);
    }
  };

  const handleOpenShelfDir = async () => {
    if (openingShelfDir || !hasBaseDir) return;
    setOpeningShelfDir(true);
    try {
      await apiOpenOutputDir();
    } catch (error) {
      toast.error(formatToolActionError("打开下载目录", error));
    } finally {
      setOpeningShelfDir(false);
    }
  };

  const handleBulkDelete = async () => {
    if (bulkDeleting || selectedVisiblePaths.length === 0) return;
    setBulkDeleting(true);
    const failedPaths: string[] = [];
    try {
      for (const path of selectedVisiblePaths) {
        try {
          await apiDeleteBook(path);
        } catch {
          failedPaths.push(path);
        }
      }
      await qc.invalidateQueries({ queryKey: ["books"] });
      setConfirmBulkDelete(false);
      setSelectedPaths(new Set(failedPaths));
      if (failedPaths.length > 0) {
        toast.error(`已删除 ${selectedVisiblePaths.length - failedPaths.length} 本，${failedPaths.length} 本失败`);
      } else {
        toast.success(`已删除 ${selectedVisiblePaths.length} 本书`);
      }
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleCheckQuality = async (book: BookFile) => {
    if (checkingQuality === book.path) {
      setQualityReport(null);
      setCheckingQuality(null);
      return;
    }
    setCheckingQuality(book.path);
    try {
      if (!PLATFORM_CAPABILITIES.canReadLocalFiles) {
        toast.error("质量检查仅在桌面版（Tauri）中可用");
        return;
      }
      const content = await readLocalTextFile(book.path);
      setQualityReport({ book, content });
    } catch (error) {
      toast.error(formatToolActionError("读取书籍文件", error));
    } finally {
      setCheckingQuality(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setExtensionFilter("all");
  };

  const canCheckQuality = (book: BookFile) => book.extension.trim().toLowerCase() === "txt";

  const qualitySummary = useMemo(
    () =>
      qualityReport ? buildChapterQualitySummary(qualityReport.content) : null,
    [qualityReport],
  );

  useEffect(() => {
    setSelectedPaths((current) => {
      const next = reconcileBookshelfSelection(current, filtered);
      return arePathSetsEqual(current, next) ? current : next;
    });
  }, [filtered]);

  const handleExportQuality = async () => {
    if (!qualityReport || !qualitySummary || exportingQuality) return;
    setExportingQuality(true);
    try {
      const content = buildChapterQualityExportText(qualityReport.book.name, qualitySummary);
      await apiSaveTextFile(
        `${qualityReport.book.name}-章节质量报告.txt`,
        content,
      );
      toast.success("质量报告已导出");
    } catch (error) {
      toast.error(formatToolActionError("导出质量报告", error));
    } finally {
      setExportingQuality(false);
    }
  };

  if (configLoading && !config) {
    return (
      <div className="flex h-full items-center justify-center p-5">
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          正在加载书架配置...
        </p>
      </div>
    );
  }

  if (configError && !config) {
    return (
      <div className="flex h-full items-center justify-center p-5">
        <div
          className="flex w-full max-w-lg flex-col gap-4 rounded-2xl border px-5 py-5"
          style={{
            background: "var(--color-surface)",
            borderColor: "color-mix(in srgb, var(--color-danger) 28%, transparent)",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
            >
              <CircleAlert className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                书架配置加载失败
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                {configError}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void loadConfig({ force: true });
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重新加载
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const SortBtn = ({ k, label }: { k: BookshelfSortKey; label: string }) => {
    const isActive = sortKey === k;
    const Icon = sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        onClick={() => toggleSort(k)}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
        style={{
          color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
          background: isActive
            ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
            : "transparent",
        }}
      >
        {label}
        {isActive && <Icon className="h-3 w-3" />}
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-5">
      <PageHeader
        title="本地书架"
        subtitle={
          summary.totalCount > 0
            ? `显示 ${summary.filteredCount} / ${summary.totalCount} 本，约 ${filesize(summary.filteredBytes, { locale: false, standard: "iec" })}`
            : "浏览已下载的书目"
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleOpenShelfDir()}
              disabled={!hasBaseDir || openingShelfDir}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {openingShelfDir ? "打开中..." : "打开目录"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={isLoading || !hasBaseDir}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </>
        }
      />

      {/* Toolbar */}
      <div
        className="shrink-0 rounded-2xl border p-3"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
              />
              <input
                className="w-full rounded-lg border py-2 pr-9 pl-8 text-xs focus:outline-none"
                style={{
                  background: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
                placeholder="搜索书名或路径..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute top-1/2 right-2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full transition-opacity hover:opacity-70"
                  style={{ color: "var(--color-text-muted)" }}
                  title="清空搜索"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex min-w-0 gap-2 sm:w-auto sm:min-w-52">
              <div className="relative min-w-0 flex-1">
                <SlidersHorizontal
                  className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: "var(--color-text-muted)" }}
                />
                <select
                  className="w-full appearance-none rounded-lg border py-2 pr-8 pl-8 text-xs focus:outline-none"
                  style={{
                    background: "var(--color-surface-2)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                  value={extensionFilter}
                  onChange={(e) => setExtensionFilter(e.target.value)}
                >
                  <option value="all">全部格式</option>
                  {extensions.map((extension) => (
                    <option key={extension} value={extension}>
                      {extension.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  清空
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs" style={{ color: "var(--color-text-subtle)" }}>
                排序：
              </span>
              <SortBtn k="name" label="名称" />
              <SortBtn k="size" label="大小" />
              <SortBtn k="modified" label="时间" />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className="rounded-full px-2.5 py-1"
                style={{
                  color: "var(--color-text-muted)",
                  background: "var(--color-surface-2)",
                }}
              >
                {summary.filteredCount} 本
              </span>
              <span
                className="rounded-full px-2.5 py-1"
                style={{
                  color: "var(--color-text-muted)",
                  background: "var(--color-surface-2)",
                }}
              >
                总计 {filesize(summary.totalBytes, { locale: false, standard: "iec" })}
              </span>
              <span
                className="rounded-full px-2.5 py-1"
                style={{
                  color: "var(--color-text-muted)",
                  background: "var(--color-surface-2)",
                }}
              >
                TXT 可检查质量，EPUB/MOBI/AZW3 可直接打开
              </span>
            </div>
          </div>
        </div>
      </div>

      {!isLoading && !error && filtered.length > 0 && (
        <div
          className="flex shrink-0 flex-col gap-3 rounded-2xl border px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: "var(--color-surface)",
            borderColor: selectionSummary.selectedCount > 0
              ? "color-mix(in srgb, var(--color-accent) 32%, var(--color-border))"
              : "var(--color-border)",
          }}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={selectionSummary.allVisibleSelected}
                ref={(input) => {
                  if (input) input.indeterminate = selectionSummary.partiallyVisibleSelected;
                }}
                onChange={toggleVisibleSelection}
                aria-label={
                  selectionSummary.allVisibleSelected ? "取消选择当前筛选结果" : "选择当前筛选结果"
                }
              />
              <span style={{ color: "var(--color-text)" }}>
                当前结果 {selectionSummary.visibleCount} 本
              </span>
            </label>
            {selectionSummary.selectedCount > 0 && (
              <span style={{ color: "var(--color-text-muted)" }}>
                已选择 {selectionSummary.selectedCount} 本，约{" "}
                {filesize(selectionSummary.selectedBytes, { locale: false, standard: "iec" })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectionSummary.selectedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearSelection} disabled={bulkDeleting}>
                取消选择
              </Button>
            )}
            {confirmBulkDelete ? (
              <>
                <span style={{ color: "var(--color-danger)" }}>
                  确认删除所选 {selectionSummary.selectedCount} 本？
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void handleBulkDelete()}
                  disabled={bulkDeleting || selectionSummary.selectedCount === 0}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {bulkDeleting ? "删除中..." : "确认删除"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmBulkDelete(false)}
                  disabled={bulkDeleting}
                >
                  取消
                </Button>
              </>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmBulkDelete(true)}
                disabled={selectionSummary.selectedCount === 0 || bulkDeleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
                批量删除
              </Button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div
          className="flex shrink-0 flex-col gap-3 rounded-2xl border px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: "var(--color-danger-bg)",
            color: "var(--color-danger)",
            borderColor: "color-mix(in srgb, var(--color-danger) 28%, transparent)",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--color-danger) 16%, transparent)" }}
            >
              <CircleAlert className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium">书架加载失败</p>
              <p className="mt-1 text-xs opacity-90">{String(error)}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void handleRefresh()} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            重试
          </Button>
        </div>
      )}

      {/* Book list */}
      <div ref={listRef} className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
        {isLoading && (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              加载中...
            </p>
          </div>
        )}
        {!isLoading && error && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "var(--color-danger-bg)",
                border: "1px solid color-mix(in srgb, var(--color-danger) 22%, transparent)",
              }}
            >
              <CircleAlert className="h-8 w-8" style={{ color: "var(--color-danger)" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                当前无法读取书架内容
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                请先重试加载；只有请求成功且结果为空时，才会显示空书架状态。
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void handleRefresh()}>
              <RefreshCw className="h-3.5 w-3.5" />
              重新加载
            </Button>
          </div>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "var(--color-accent-muted)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
                boxShadow: "var(--shadow-accent)",
              }}
            >
              <BookOpen className="h-8 w-8" style={{ color: "var(--color-accent)" }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                {!hasBaseDir
                  ? "还没有配置下载目录"
                  : hasFilters
                    ? "没有匹配的书目"
                    : "书架是空的"}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                {!hasBaseDir
                  ? "请先在设置中配置下载目录，然后再回来刷新书架。"
                  : hasFilters
                    ? "试试其他关键词、扩展名筛选，或清空筛选条件。"
                    : `下载目录: ${baseDir}`}
              </p>
            </div>
            {!hasBaseDir ? null : hasFilters ? (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  清空筛选
                </Button>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => void handleOpenShelfDir()}>
                    <FolderOpen className="h-3.5 w-3.5" />
                    打开目录
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void handleRefresh()}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    重新扫描
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void loadConfig({ force: true });
                  }}
                >
                  重新读取配置
                </Button>
              </div>
            )}
            {!hasBaseDir && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void loadConfig({ force: true });
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重新读取配置
              </Button>
            )}
            {!hasBaseDir && (
              <Button variant="secondary" size="sm" onClick={() => navigate("/settings")}>
                前往设置目录
              </Button>
            )}
          </div>
        )}
        {!isLoading && !error && filtered.length > 0 && (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const book = filtered[virtualRow.index];
              return (
                <div
                  key={book.path}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: "6px",
                  }}
                >
                  <div
                    className="flex flex-col gap-3 rounded-xl border px-4 py-3 transition-all sm:flex-row sm:items-center"
                    style={{
                      background: "var(--color-surface)",
                      borderColor: selectedPaths.has(book.path)
                        ? "color-mix(in srgb, var(--color-accent) 38%, var(--color-border))"
                        : "var(--color-border)",
                    }}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <label className="mt-1 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5"
                          checked={selectedPaths.has(book.path)}
                          onChange={() => toggleBookSelection(book.path)}
                          aria-label={
                            selectedPaths.has(book.path)
                              ? `取消选择 ${book.name}`
                              : `选择 ${book.name}`
                          }
                        />
                      </label>
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background: "var(--color-accent-muted)",
                          border:
                            "1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)",
                        }}
                      >
                        <FileText className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-medium"
                          style={{ color: "var(--color-text)" }}
                        >
                          {book.name}
                        </p>
                        <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                          {filesize(book.size, { locale: false, standard: "iec" })} ·{" "}
                          {formatDate(book.modified)} · {book.extension.toUpperCase()}
                        </p>
                        <p
                          className="mt-1 truncate text-[11px]"
                          style={{ color: "var(--color-text-subtle)" }}
                          title={book.path}
                        >
                          {book.path}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:ml-auto">
                      <button
                        onClick={() => void handleOpenBook(book.path)}
                        className="flex min-w-20 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:opacity-80"
                        style={{
                          borderColor: "var(--color-border)",
                          color: "var(--color-text-muted)",
                          background: "var(--color-surface-2)",
                        }}
                        disabled={openingBook === book.path}
                        title="打开文件"
                        aria-label={`打开 ${book.name}`}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        {openingBook === book.path ? "打开中..." : "打开"}
                      </button>
                      <button
                        onClick={() => void handleOpenBookParent(book.path)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:opacity-80"
                        style={{ color: "var(--color-text-muted)" }}
                        disabled={openingParent !== null && openingParent !== book.path}
                        title="定位到文件所在目录"
                        aria-label={
                          openingParent === book.path
                            ? `正在打开 ${book.name} 所在目录`
                            : `打开 ${book.name} 所在目录`
                        }
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => void handleCheckQuality(book)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:opacity-80"
                        style={{
                          color:
                            qualityReport?.book.path === book.path
                              ? "var(--color-accent)"
                              : "var(--color-text-muted)",
                          opacity: canCheckQuality(book) ? 1 : 0.45,
                        }}
                        disabled={
                          !canCheckQuality(book) ||
                          (checkingQuality !== null && checkingQuality !== book.path)
                        }
                        title={
                          canCheckQuality(book)
                            ? "章节质量检查"
                            : "仅 TXT 文件支持章节质量检查"
                        }
                        aria-label={
                          !canCheckQuality(book)
                            ? `${book.name} 不是 TXT 文件，暂不支持章节质量检查`
                            : checkingQuality === book.path
                            ? `正在检查 ${book.name} 的章节质量`
                            : `检查 ${book.name} 的章节质量`
                        }
                      >
                        <Activity className="h-3.5 w-3.5" />
                      </button>
                      {confirmDelete === book.path ? (
                        <div className="ml-1 flex flex-wrap items-center justify-end gap-1.5">
                          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            确认删除？
                          </span>
                          <button
                            onClick={() => deleteMutation.mutate(book.path)}
                            className="rounded px-2 py-1 text-xs font-medium"
                            style={{ background: "var(--color-danger)", color: "#fff" }}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? "删除中..." : "删除"}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="rounded border px-2 py-1 text-xs"
                            style={{
                              borderColor: "var(--color-border)",
                              color: "var(--color-text-muted)",
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(book.path)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:opacity-80"
                          style={{ color: "var(--color-danger)" }}
                          disabled={deleteMutation.isPending}
                          title="删除"
                          aria-label={`删除 ${book.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quality report panel */}
      {qualityReport && (
        <div
          className="shrink-0 rounded-xl border p-4"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                《{qualityReport.book.name}》章节质量报告
              </span>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                {qualitySummary
                  ? `共 ${qualitySummary.chapters.length} 章，可疑章节 ${qualitySummary.suspiciousCount} 章`
                  : "正在分析章节结构..."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleExportQuality()}
                disabled={!qualitySummary || exportingQuality}
              >
                <Download className="h-3.5 w-3.5" />
                {exportingQuality ? "导出中..." : "导出报告"}
              </Button>
              <button
                onClick={() => setQualityReport(null)}
                className="rounded-md p-1 hover:opacity-70"
                style={{ color: "var(--color-text-muted)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <ChapterQualityReport content={qualityReport.content} />
        </div>
      )}
    </div>
  );
}

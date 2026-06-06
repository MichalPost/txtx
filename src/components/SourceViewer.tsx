import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Code2, Loader2, Sparkles, X } from "lucide-react";

import { useAiStore } from "@/store/aiStore";
import type { WebsiteConfig } from "@/types";

import { AiAnalysisPanel } from "./source-viewer/AiAnalysisPanel";
import { generateXPathFromLine, highlightLine } from "./source-viewer/sourceViewerUtils";
import { useAiXPathAnalysis } from "./source-viewer/useAiXPathAnalysis";
import { useSourceFetch } from "./source-viewer/useSourceFetch";
import { XPathStatusBar } from "./source-viewer/XPathStatusBar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SourceViewerProps {
  defaultUrl?: string;
  onXPathSelect?: (
    xpath: string,
    field: keyof Pick<
      WebsiteConfig,
      | "list_novel_name"
      | "release_date"
      | "release_url"
      | "novel_name_x"
      | "chapter_url_x"
      | "novel_content"
    >,
  ) => void;
  onClose: () => void;
}

// ─── SourceViewer ─────────────────────────────────────────────────────────────

export function SourceViewer({ defaultUrl, onXPathSelect, onClose }: SourceViewerProps) {
  const { url, setUrl, html, loading, error, fetchSource } = useSourceFetch(defaultUrl);
  const [search, setSearch] = useState("");
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [generatedXPath, setGeneratedXPath] = useState("");

  const aiEnabled = useAiStore((s) => s.config.enabled);
  const {
    aiOpen,
    setAiOpen,
    aiIntent,
    setAiIntent,
    aiLoading,
    aiResult,
    setAiResult,
    aiError,
    runAiAnalysis,
  } = useAiXPathAnalysis(html);

  const lines = useMemo(() => (html ? html.split("\n") : []), [html]);

  const matchCount = useMemo(() => {
    if (!search || !lines.length) return 0;
    const s = search.toLowerCase();
    return lines.reduce((acc, l) => acc + (l.toLowerCase().includes(s) ? 1 : 0), 0);
  }, [search, lines]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20,
    overscan: 10,
  });

  const handleLineClick = (lineIndex: number) => {
    setSelectedLine(lineIndex);
    const xpath = generateXPathFromLine(lines[lineIndex]);
    if (xpath) setGeneratedXPath(xpath);
  };

  useEffect(() => {
    if (!search || !lines.length) return;
    const idx = lines.findIndex((l) => l.toLowerCase().includes(search.toLowerCase()));
    if (idx !== -1) virtualizer.scrollToIndex(idx, { align: "center" });
  }, [search, lines, virtualizer]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col overflow-hidden rounded-2xl border"
        style={{
          width: "90vw",
          maxWidth: "72rem",
          height: "85vh",
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Title bar ─────────────────────────────── */}
        <div
          className="flex shrink-0 items-center gap-3 border-b px-5 py-3.5"
          style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}
        >
          <Code2 className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
          <span className="flex-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            源代码查看器
          </span>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:opacity-80"
            style={{ background: "var(--color-surface)", color: "var(--color-text-muted)" }}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Toolbar ───────────────────────────────── */}
        <div
          className="flex shrink-0 flex-col gap-2 border-b px-4 py-3"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
        >
          {/* URL row */}
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchSource()}
              placeholder="https://example.com/novels"
              className="flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-accent)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <button
              className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "var(--color-accent)",
                color: "#fff",
                boxShadow: "var(--shadow-accent)",
              }}
              onClick={fetchSource}
              disabled={loading || !url.trim()}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {loading ? "获取中..." : "获取源码"}
            </button>
          </div>

          {/* Search row */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索关键词…"
              className="flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-accent)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {search && (
              <span
                className="shrink-0 text-xs tabular-nums"
                style={{ color: "var(--color-text-muted)" }}
              >
                {matchCount} 处匹配
              </span>
            )}
          </div>

          {/* AI panel */}
          {aiEnabled ? (
            <AiAnalysisPanel
              html={html}
              aiOpen={aiOpen}
              setAiOpen={setAiOpen}
              aiIntent={aiIntent}
              setAiIntent={setAiIntent}
              aiLoading={aiLoading}
              aiResult={aiResult}
              setAiResult={setAiResult}
              aiError={aiError}
              onRunAnalysis={runAiAnalysis}
              onXPathFromAi={(xpath) => setGeneratedXPath(xpath)}
            />
          ) : html ? (
            <div
              className="flex items-center gap-2 pt-2"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <Sparkles
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: "var(--color-text-subtle)" }}
              />
              <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                在设置页启用 AI 助手可自动生成 XPath
              </span>
            </div>
          ) : null}
        </div>

        {/* ── Main content ──────────────────────────── */}
        <div className="relative flex-1 overflow-hidden">
          {!html && !loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Code2
                className="h-10 w-10 opacity-20"
                style={{ color: "var(--color-text-subtle)" }}
              />
              <p className="text-sm" style={{ color: "var(--color-text-subtle)" }}>
                输入 URL 并点击「获取源码」查看页面 HTML
              </p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8">
              <p className="text-sm font-medium" style={{ color: "var(--color-danger)" }}>
                获取失败
              </p>
              <p className="text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
                {error}
              </p>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--color-accent)" }} />
              <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                正在获取页面源码…
              </span>
            </div>
          )}

          {html && !loading && (
            <div
              ref={parentRef}
              className="h-full overflow-x-auto overflow-y-auto"
              style={{ fontFamily: "var(--font-mono, monospace)" }}
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const lineIndex = virtualRow.index;
                  const line = lines[lineIndex];
                  const isSelected = selectedLine === lineIndex;
                  const isHovered = hoveredLine === lineIndex;
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className="flex cursor-pointer items-start select-text"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                        minHeight: "20px",
                        background: isSelected
                          ? "var(--color-accent-muted)"
                          : isHovered
                            ? "var(--color-surface-2)"
                            : "transparent",
                        borderLeft: isSelected
                          ? "2px solid var(--color-accent)"
                          : "2px solid transparent",
                      }}
                      onMouseEnter={() => setHoveredLine(lineIndex)}
                      onMouseLeave={() => setHoveredLine(null)}
                      onClick={() => handleLineClick(lineIndex)}
                    >
                      <span
                        className="shrink-0 pr-3 pl-2 text-right select-none"
                        style={{
                          width: "3.5rem",
                          fontSize: "0.7rem",
                          lineHeight: "20px",
                          color: "var(--color-text-subtle)",
                          userSelect: "none",
                        }}
                      >
                        {lineIndex + 1}
                      </span>
                      <span
                        className="flex-1 pr-4 text-xs whitespace-pre"
                        style={{
                          lineHeight: "20px",
                          color: "var(--color-text)",
                          wordBreak: "keep-all",
                        }}
                      >
                        {highlightLine(line, search)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Status bar ────────────────────────────── */}
        <XPathStatusBar
          xpath={generatedXPath}
          html={html}
          lineCount={lines.length}
          selectedLine={selectedLine}
          onXPathSelect={onXPathSelect}
        />
      </div>
    </div>
  );
}

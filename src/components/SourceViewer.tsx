import { useState, useMemo, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { X, Code2, Copy, Check, ChevronDown, Loader2, Sparkles, ChevronUp, AlertCircle } from "lucide-react";
import { apiFetchSource } from "@/lib/api/files";
import type { WebsiteConfig } from "@/types";
import { useAiStore } from "@/store/aiStore";
import { aiComplete, preprocessHtml, extractJson, validateXPath } from "@/lib/ai";

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
    >
  ) => void;
  onClose: () => void;
}

const XPATH_FIELDS: {
  key: keyof Pick<
    WebsiteConfig,
    | "list_novel_name"
    | "release_date"
    | "release_url"
    | "novel_name_x"
    | "chapter_url_x"
    | "novel_content"
  >;
  label: string;
}[] = [
  { key: "list_novel_name", label: "列表页书名" },
  { key: "release_date", label: "发布日期" },
  { key: "release_url", label: "发布链接" },
  { key: "novel_name_x", label: "详情页书名" },
  { key: "chapter_url_x", label: "章节链接" },
  { key: "novel_content", label: "章节内容" },
];

// ─── Pure helpers (defined outside component) ─────────────────────────────────

function highlightLine(line: string, search: string): React.ReactNode {
  if (!search) return line;
  const lower = line.toLowerCase();
  const searchLower = search.toLowerCase();
  if (!lower.includes(searchLower)) return line;

  const parts: React.ReactNode[] = [];
  let last = 0;
  let idx = lower.indexOf(searchLower);
  while (idx !== -1) {
    if (idx > last) parts.push(line.slice(last, idx));
    parts.push(
      <mark
        key={idx}
        style={{
          background: "color-mix(in srgb, var(--color-warning) 35%, transparent)",
          color: "var(--color-warning)",
          borderRadius: "2px",
        }}
      >
        {line.slice(idx, idx + search.length)}
      </mark>
    );
    last = idx + search.length;
    idx = lower.indexOf(searchLower, last);
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

function generateXPathFromLine(line: string): string {
  const trimmed = line.trim();
  // Match opening tag
  const tagMatch = trimmed.match(/^<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/);
  if (!tagMatch) return "";
  const tag = tagMatch[1].toLowerCase();
  const rest = tagMatch[0];

  // id attribute
  const idMatch = rest.match(/id=["']([^"']+)["']/);
  if (idMatch) return `//${tag}[@id="${idMatch[1]}"]`;

  // class attribute
  const classMatch = rest.match(/class=["']([^"']+)["']/);
  if (classMatch) {
    const firstClass = classMatch[1].trim().split(/\s+/)[0];
    return `//${tag}[@class="${firstClass}"]`;
  }

  // name attribute
  const nameMatch = rest.match(/name=["']([^"']+)["']/);
  if (nameMatch) return `//${tag}[@name="${nameMatch[1]}"]`;

  return `//${tag}`;
}

// ─── SourceViewer ─────────────────────────────────────────────────────────────

export function SourceViewer({ defaultUrl, onXPathSelect, onClose }: SourceViewerProps) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [generatedXPath, setGeneratedXPath] = useState("");
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── AI panel state ────────────────────────────────────────────────
  const [aiOpen, setAiOpen] = useState(false);
  const [aiIntent, setAiIntent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    xpath: string;
    explanation: string;
    alternatives: string[];
    validation: { count: number; samples: string[]; error?: string } | null;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const { config: aiConfig } = useAiStore();

  // Derived
  const lines = useMemo(() => (html ? html.split("\n") : []), [html]);

  const matchCount = useMemo(() => {
    if (!search || !lines.length) return 0;
    const s = search.toLowerCase();
    return lines.reduce((acc, l) => acc + (l.toLowerCase().includes(s) ? 1 : 0), 0);
  }, [search, lines]);

  // Virtual list
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20,
    overscan: 10,
  });

  // Fetch source
  const fetchSource = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setHtml("");
    setSelectedLine(null);
    setGeneratedXPath("");
    try {
      const result = await apiFetchSource(url.trim());
      setHtml(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };


  // ── AI analysis ───────────────────────────────────────────────────
  const INTENT_PRESETS = [
    "书名列表（列表页）",
    "更新日期",
    "章节目录链接",
    "正文内容",
    "详情页书名",
  ];

  const AI_SYSTEM_PROMPT = `你是专门分析中文小说网站 HTML 结构的专家。用户会给你 HTML 源码和提取目标。
你的任务是生成精确的 XPath 表达式。

规则：
1. 优先使用 id 或 class 属性定位，避免纯位置 XPath
2. 提取文本用 /text()，提取属性用 /@href 等
3. 优先生成 // 开头的全局路径
4. 输出严格 JSON，不含其他内容：
{"xpath":"...","explanation":"...","alternatives":["..."]}`;

  const runAiAnalysis = async () => {
    if (!aiConfig.enabled || !aiConfig.base_url || !aiIntent.trim() || !html) return;

    aiAbortRef.current?.abort();
    aiAbortRef.current = new AbortController();

    setAiLoading(true);
    setAiResult(null);
    setAiError(null);

    try {
      const processedHtml = preprocessHtml(html);
      const userPrompt = `目标：${aiIntent}\n\nHTML：\n${processedHtml}`;

      const raw = await aiComplete(userPrompt, AI_SYSTEM_PROMPT, aiConfig);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(raw) as any;

      const xpath: string = parsed?.xpath ?? "";
      const explanation: string = parsed?.explanation ?? "";
      const alternatives: string[] = Array.isArray(parsed?.alternatives)
        ? parsed.alternatives.filter((x: unknown) => typeof x === "string")
        : [];

      const validation = xpath ? validateXPath(html, xpath) : null;

      setAiResult({ xpath, explanation, alternatives, validation });
      if (xpath) setGeneratedXPath(xpath);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setAiError(String(e));
      }
    } finally {
      setAiLoading(false);
    }
  };

  // Handle line click
  const handleLineClick = (lineIndex: number) => {
    setSelectedLine(lineIndex);
    const xpath = generateXPathFromLine(lines[lineIndex]);
    if (xpath) setGeneratedXPath(xpath);
  };

  // Copy XPath
  const copyXPath = () => {
    if (!generatedXPath) return;
    navigator.clipboard.writeText(generatedXPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Scroll to first search match
  useEffect(() => {
    if (!search || !lines.length) return;
    const idx = lines.findIndex((l) => l.toLowerCase().includes(search.toLowerCase()));
    if (idx !== -1) virtualizer.scrollToIndex(idx, { align: "center" });
  }, [search, lines, virtualizer]);

  // Close field picker on outside click
  useEffect(() => {
    if (!showFieldPicker) return;
    const handler = () => setShowFieldPicker(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showFieldPicker]);

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      {/* Content area */}
      <div
        className="flex flex-col rounded-2xl border overflow-hidden"
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
        {/* ── Title bar ─────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-5 py-3.5 border-b shrink-0"
          style={{
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
          }}
        >
          <Code2 className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
          <span className="flex-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            源代码查看器
          </span>
          <button
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:opacity-80"
            style={{ background: "var(--color-surface)", color: "var(--color-text-muted)" }}
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Toolbar ───────────────────────────────────── */}
        <div
          className="flex flex-col gap-2 px-4 py-3 border-b shrink-0"
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
              className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
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
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--color-accent)",
                color: "#fff",
                boxShadow: "var(--shadow-accent)",
              }}
              onClick={fetchSource}
              disabled={loading || !url.trim()}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : null}
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
              className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
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
              <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--color-text-muted)" }}>
                {matchCount} 处匹配
              </span>
            )}
          </div>

          {/* ── AI panel ──────────────────────────────── */}
          {aiConfig.enabled ? (
            <div style={{ borderTop: "1px solid var(--color-border)" }}>
              {/* Toggle header */}
              <button
                className="w-full flex items-center gap-2 px-1 py-2 text-left transition-colors hover:opacity-80"
                style={{ background: "transparent" }}
                onClick={() => setAiOpen((v) => !v)}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
                <span className="flex-1 text-xs font-medium" style={{ color: "var(--color-accent)" }}>
                  AI 分析
                </span>
                <ChevronUp
                  className="w-3.5 h-3.5 transition-transform"
                  style={{
                    color: "var(--color-text-muted)",
                    transform: aiOpen ? "rotate(0deg)" : "rotate(180deg)",
                  }}
                />
              </button>

              {aiOpen && (
                <div className="flex flex-col gap-2.5 pb-3">
                  {/* Intent quick presets */}
                  <div className="flex flex-wrap gap-1.5">
                    {INTENT_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        className="text-xs px-2.5 py-1 rounded-full border transition-all hover:opacity-80"
                        style={{
                          background: aiIntent === preset ? "var(--color-accent-muted)" : "var(--color-surface)",
                          borderColor: aiIntent === preset ? "var(--color-accent)" : "var(--color-border)",
                          color: aiIntent === preset ? "var(--color-accent)" : "var(--color-text-muted)",
                        }}
                        onClick={() => setAiIntent(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Intent input + run */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiIntent}
                      onChange={(e) => setAiIntent(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && runAiAnalysis()}
                      placeholder="描述你要提取什么，例如：列表页每本书的链接"
                      className="flex-1 border rounded-lg px-3 py-1.5 text-xs focus:outline-none"
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: "var(--color-accent)",
                        color: "#fff",
                        boxShadow: "var(--shadow-accent)",
                      }}
                      onClick={runAiAnalysis}
                      disabled={aiLoading || !html || !aiIntent.trim()}
                    >
                      {aiLoading
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Sparkles className="w-3 h-3" />}
                      {aiLoading ? "分析中..." : "分析"}
                    </button>
                  </div>

                  {/* Error */}
                  {aiError && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
                      style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{aiError}</span>
                    </div>
                  )}

                  {/* Result */}
                  {aiResult && (
                    <div className="flex flex-col gap-2 p-3 rounded-xl border"
                      style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}>
                      {/* XPath */}
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono truncate"
                          style={{ color: "var(--color-accent)" }}
                          title={aiResult.xpath}>
                          {aiResult.xpath}
                        </code>
                      </div>

                      {/* Validation badge */}
                      {aiResult.validation && (
                        <div className="flex items-center gap-1.5">
                          {aiResult.validation.error ? (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
                              语法错误
                            </span>
                          ) : aiResult.validation.count === 0 ? (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}>
                              命中 0 个，可能不适用当前页面
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
                              命中 {aiResult.validation.count} 个
                            </span>
                          )}
                          {aiResult.validation.samples.length > 0 && (
                            <span className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                              样本：{aiResult.validation.samples.slice(0, 3).join("、")}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Explanation */}
                      {aiResult.explanation && (
                        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                          {aiResult.explanation}
                        </p>
                      )}

                      {/* Alternatives */}
                      {aiResult.alternatives.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>备选：</span>
                          {aiResult.alternatives.map((alt) => (
                            <button
                              key={alt}
                              className="text-xs px-2 py-0.5 rounded border hover:opacity-80 transition-opacity font-mono"
                              style={{
                                background: "var(--color-surface)",
                                borderColor: "var(--color-border)",
                                color: "var(--color-text-muted)",
                              }}
                              onClick={() => {
                                setGeneratedXPath(alt);
                                const v = validateXPath(html, alt);
                                setAiResult((r) => r ? { ...r, xpath: alt, validation: v } : r);
                              }}
                            >
                              {alt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            html ? (
              <div className="flex items-center gap-2 pt-2"
                style={{ borderTop: "1px solid var(--color-border)" }}>
                <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-subtle)" }} />
                <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                  在设置页启用 AI 助手可自动生成 XPath
                </span>
              </div>
            ) : null
          )}
        </div>

        {/* ── Main content ──────────────────────────────── */}
        <div className="flex-1 overflow-hidden relative">
          {/* Empty state */}
          {!html && !loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Code2 className="w-10 h-10 opacity-20" style={{ color: "var(--color-text-subtle)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-subtle)" }}>
                输入 URL 并点击「获取源码」查看页面 HTML
              </p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8">
              <p className="text-sm font-medium" style={{ color: "var(--color-danger)" }}>
                获取失败
              </p>
              <p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
                {error}
              </p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--color-accent)" }} />
              <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                正在获取页面源码…
              </span>
            </div>
          )}

          {/* Virtual list */}
          {html && !loading && (
            <div
              ref={parentRef}
              className="h-full overflow-y-auto overflow-x-auto"
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
                      className="flex items-start cursor-pointer select-text"
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
                      {/* Line number */}
                      <span
                        className="shrink-0 text-right select-none pr-3 pl-2"
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
                      {/* Source line */}
                      <span
                        className="text-xs whitespace-pre flex-1 pr-4"
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

        {/* ── Status bar ────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 border-t shrink-0"
          style={{
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
            minHeight: "44px",
          }}
        >
          {generatedXPath ? (
            <>
              <span className="text-xs shrink-0" style={{ color: "var(--color-text-subtle)" }}>
                XPath:
              </span>
              <code
                className="flex-1 text-xs font-mono truncate"
                style={{ color: "var(--color-accent)" }}
                title={generatedXPath}
              >
                {generatedXPath}
              </code>
              <button
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all shrink-0 hover:opacity-80"
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: copied ? "var(--color-success, #22c55e)" : "var(--color-text-muted)",
                }}
                onClick={copyXPath}
              >
                {copied ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                {copied ? "已复制" : "复制"}
              </button>

              {onXPathSelect && (
                <div className="relative shrink-0">
                  <button
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all hover:opacity-80"
                    style={{
                      background: "var(--color-accent)",
                      borderColor: "transparent",
                      color: "#fff",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFieldPicker((v) => !v);
                    }}
                  >
                    填入
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {showFieldPicker && (
                    <div
                      className="absolute bottom-full right-0 mb-1.5 rounded-xl border overflow-hidden"
                      style={{
                        background: "var(--color-surface)",
                        borderColor: "var(--color-border)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                        minWidth: "10rem",
                        zIndex: 10,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {XPATH_FIELDS.map((f) => (
                        <button
                          key={f.key}
                          className="w-full text-left px-3.5 py-2 text-xs transition-colors hover:opacity-80"
                          style={{
                            color: "var(--color-text)",
                            background: "transparent",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--color-surface-2)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                          onClick={() => {
                            onXPathSelect(generatedXPath, f.key);
                            setShowFieldPicker(false);
                          }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
              {html ? "点击某行标签以生成 XPath" : "获取源码后点击行以生成 XPath"}
            </span>
          )}

          {/* Line count info on right */}
          {html && (
            <span
              className="ml-auto text-xs tabular-nums shrink-0"
              style={{ color: "var(--color-text-subtle)" }}
            >
              {lines.length} 行
              {selectedLine !== null ? ` · 第 ${selectedLine + 1} 行` : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Step 1 — 最近更新列表页
 *
 * 合并了"输入 URL → 拉取 HTML → 配置三条规则 + 分页 → 实时预览书籍列表"
 * 一步完成，用户看到正确的书籍列表后直接进入第二步选书。
 */
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { validateXPath } from "@/lib/ai";
import { apiFetchSource } from "@/lib/api/files";

import { BookListPreview } from "./components/BookListPreview";
import { BookNameConfig, buildBookNameXPath } from "./components/BookNameConfig";
import { PaginationSection } from "./components/PaginationSection";
import { WizardSection } from "./components/WizardSection";
import { FieldRuleEditor } from "./FieldRuleEditor";
import { useListPageAi } from "./hooks/useListPageAi";
import {
  buildXPathFromRule,
  detectCharset,
  type FieldRule,
  type UpdateListBookItem,
  type WizardData,
} from "./ruleUtils";
import { detectPagination, type PaginationDetectResult } from "./utils/paginationDetect";
import { evalXPathAll, mergeBooks } from "./utils/xpathEval";

// Re-export for consumers that import from here
export type { UpdateListBookItem };
export { detectPagination };
export type { PaginationDetectResult };

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

type FetchStatus = "idle" | "loading" | "ok" | "error";

// ─── Common rule presets ───────────────────────────────────────────────────────

const COMMON_URL_RULES = [
  { label: "-- 常用链接规则 --", value: "" },
  { label: "li > a href", value: "//li/a/@href" },
  { label: "ul li a href", value: "//ul/li/a/@href" },
  { label: "div.list a href", value: "//div[contains(@class,'list')]//a/@href" },
  { label: "div.update a href", value: "//div[contains(@class,'update')]//a/@href" },
  { label: "table td a href", value: "//table//td/a/@href" },
  { label: "dt a href", value: "//dt/a/@href" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function reparseBooks(data: WizardData): UpdateListBookItem[] {
  const html = data.update_list_html;
  if (!html) return [];
  const nameXPath = buildXPathFromRule(data.list_novel_name);
  const urlXPath = buildXPathFromRule(data.list_release_url);
  const dateXPath = buildXPathFromRule(data.list_release_date);
  if (!nameXPath || !urlXPath) return [];
  const names = evalXPathAll(html, nameXPath);
  const urls = evalXPathAll(html, urlXPath);
  const dates = dateXPath ? evalXPathAll(html, dateXPath) : [];
  return mergeBooks(names, urls, dates, data.update_list_url);
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function WizardStep1UpdateList({ data, onChange }: Props) {
  const navigate = useNavigate();
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [fetchError, setFetchError] = useState("");
  const [showSource, setShowSource] = useState(false);
  const [autoMatchLoading, setAutoMatchLoading] = useState(false);
  const [paginationDetected, setPaginationDetected] = useState<{
    method: string;
    page_total: number;
    page_insert_part: string;
  } | null>(null);
  const [bookNameTest, setBookNameTest] = useState<{ count: number; sample: string } | null>(null);

  // ── Fetch HTML ──────────────────────────────────────────────────────────────

  const ensureHtml = async (): Promise<string> => {
    if (data.update_list_html) return data.update_list_html;
    const url = data.update_list_url.trim();
    if (!url || url === "https://") throw new Error("请先填写最近更新列表页网址");
    const html = await apiFetchSource(url);
    onChange({ ...data, update_list_html: html });
    return html;
  };

  const handleFetch = async () => {
    const url = data.update_list_url.trim();
    if (!url || url === "https://") return;
    setFetchStatus("loading");
    setFetchError("");
    setPaginationDetected(null);
    try {
      const html = await apiFetchSource(url);
      const detectedEncoding = detectCharset(html);
      const books = reparseBooks({ ...data, update_list_html: html });

      let paginationPatch: Partial<WizardData> = {};
      const detected = detectPagination(html, url);

      if (detected && !data.has_pagination) {
        paginationPatch = {
          has_pagination: true,
          page_url_mode: detected.page_url_mode,
          page_insert_part: detected.page_insert_part,
          page_total: detected.page_total,
        };
      }
      if (detected) setPaginationDetected(detected);

      onChange({
        ...data,
        ...paginationPatch,
        update_list_html: html,
        update_books: books,
        encoding: data.encoding || detectedEncoding,
      });
      setFetchStatus("ok");
    } catch (e) {
      setFetchError(String(e));
      setFetchStatus("error");
    }
  };

  // ── AI hook ────────────────────────────────────────────────────────────────

  const { aiEnabled, aiLoading, aiError, setAiError, runBatchAi, runFieldAi, runPaginationAi } =
    useListPageAi(data, onChange, ensureHtml);

  // ── Rule patch helper ──────────────────────────────────────────────────────

  const patchRule = useCallback(
    (key: "list_novel_name" | "list_release_date" | "list_release_url", rule: FieldRule) => {
      const next = { ...data, [key]: rule };
      const books = reparseBooks(next);
      onChange({ ...next, update_books: books });
    },
    [data, onChange],
  );

  // ── Auto-match ─────────────────────────────────────────────────────────────

  const runAutoMatch = async () => {
    setAutoMatchLoading(true);
    setAiError("");
    try {
      const html = await ensureHtml();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const candidates = [
        "//div[contains(@class,'update')]//a/@href",
        "//div[contains(@class,'list')]//a/@href",
        "//ul[contains(@class,'list')]//a/@href",
        "//ul//li/a/@href",
        "//dl//dt/a/@href",
        "//table//td/a/@href",
      ];
      let bestXpath = "";
      let bestCount = 0;
      for (const xpath of candidates) {
        try {
          const snap = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (snap.snapshotLength > bestCount) {
            bestCount = snap.snapshotLength;
            bestXpath = xpath;
          }
        } catch {
          /* skip */
        }
      }
      const rule: FieldRule = {
        ...data.list_release_url,
        mode: "xpath",
        xpath: bestXpath || data.list_release_url.xpath,
      };
      const next = { ...data, update_list_html: html, list_release_url: rule };
      onChange({ ...next, update_books: reparseBooks(next) });
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAutoMatchLoading(false);
    }
  };

  // ── Book name test ───────────────────────────────────────────────────────────

  const bookNamePreview = useMemo(() => buildBookNameXPath(data), [data]);

  const testBookName = () => {
    if (!data.update_list_html) {
      setAiError("请先获取页面");
      return;
    }
    const xpath = bookNamePreview;
    if (!xpath) {
      setBookNameTest(null);
      return;
    }
    const v = validateXPath(data.update_list_html, xpath);
    setBookNameTest({ count: v.count, sample: v.samples[0] ?? "" });
  };

  // ── Derived stats ────────────────────────────────────────────────────────────

  const htmlSize = data.update_list_html
    ? `${(data.update_list_html.length / 1024).toFixed(1)} KB`
    : null;
  const bookCount = data.update_books.length;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Instruction ─────────────────────────────────────────────────── */}
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3"
        style={{
          background: "var(--color-accent-muted)",
          borderLeft: "2px solid var(--color-accent)",
        }}
      >
        <Globe className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>
            第一步：最近更新列表页
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            输入站点的「最近更新」或「书籍列表」页地址，拉取后配置书名、链接、更新日期三条规则。列表解析正确后，下一步从中选一本书进入目录配置。
          </p>
        </div>
      </div>

      {/* ── URL + fetch ─────────────────────────────────────────────────── */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="最近更新列表页地址"
            placeholder="https://example.com/update/ 或 /list/latest/"
            value={data.update_list_url}
            onChange={(e) => {
              onChange({ ...data, update_list_url: e.target.value, update_list_html: "" });
              setFetchStatus("idle");
              setPaginationDetected(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFetch();
            }}
          />
        </div>
        <Button
          size="sm"
          variant={fetchStatus === "ok" ? "secondary" : "primary"}
          onClick={handleFetch}
          disabled={
            fetchStatus === "loading" ||
            !data.update_list_url.trim() ||
            data.update_list_url === "https://"
          }
        >
          {fetchStatus === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          {fetchStatus === "loading" ? "获取中..." : "获取页面"}
        </Button>
      </div>

      {/* Fetch status */}
      {fetchStatus === "ok" && (
        <div className="flex flex-col gap-1.5">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">页面获取成功（{htmlSize}），已缓存，可配置下方规则</span>
          </div>
          {paginationDetected && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
              style={{
                background: "var(--color-accent-muted)",
                color: "var(--color-accent)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
              }}
            >
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              <span className="flex-1">
                已自动检测到分页（{paginationDetected.method}）：共 {paginationDetected.page_total}{" "}
                页，插入片段「{paginationDetected.page_insert_part}」
              </span>
              <button
                className="shrink-0 text-xs underline opacity-70 hover:opacity-100"
                onClick={() => {
                  onChange({ ...data, has_pagination: false });
                  setPaginationDetected(null);
                }}
              >
                撤销
              </button>
            </div>
          )}
        </div>
      )}
      {fetchStatus === "error" && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{fetchError || "页面请求失败，请检查网址"}</span>
        </div>
      )}

      {/* ── Quick tools row ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={runAutoMatch} disabled={autoMatchLoading}>
          {autoMatchLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          自动匹配链接
        </Button>

        <select
          className="rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
          style={{
            background: "var(--color-surface-1)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
            flex: "1 1 140px",
            minWidth: 0,
          }}
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const rule: FieldRule = { ...data.list_release_url, mode: "xpath", xpath: v };
            const next = { ...data, list_release_url: rule };
            onChange({ ...next, update_books: reparseBooks(next) });
          }}
        >
          {COMMON_URL_RULES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <button
          onClick={async () => {
            if (!data.update_list_html) {
              try {
                await ensureHtml();
              } catch {
                /* ignore */
              }
            }
            setShowSource((v) => !v);
          }}
          className="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
          style={{
            background: showSource ? "var(--color-accent-muted)" : "var(--color-surface-1)",
            borderColor: showSource
              ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
              : "var(--color-border)",
            color: showSource ? "var(--color-accent)" : "var(--color-text-muted)",
          }}
        >
          <Code2 className="h-3 w-3" />
          源码
        </button>

        {aiEnabled ? (
          <Button size="sm" onClick={runBatchAi} disabled={aiLoading !== null}>
            {aiLoading === "batch" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {aiLoading === "batch" ? "AI 分析中..." : "AI 批量分析"}
          </Button>
        ) : (
          <button
            onClick={() => navigate("/settings?tab=ai")}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
            style={{
              background: "var(--color-surface-1)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-subtle)",
            }}
          >
            <Sparkles className="h-3 w-3" style={{ color: "var(--color-text-subtle)" }} />
            AI 未启用（点此开启）
          </button>
        )}
      </div>

      {/* Source preview */}
      {showSource && data.update_list_html && (
        <div
          className="overflow-auto rounded-lg border p-2 font-mono text-xs leading-relaxed"
          style={{
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
            maxHeight: 160,
            color: "var(--color-text-muted)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {data.update_list_html.slice(0, 8000)}
          {data.update_list_html.length > 8000 && "\n\n… 已截断（仅显示前 8000 字符）"}
        </div>
      )}

      {/* AI / general error */}
      {aiError && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{aiError}</span>
        </div>
      )}

      {/* ── Rule editors ────────────────────────────────────────────────── */}
      <WizardSection title="列表页规则（必填）" color="var(--color-danger)">
        <FieldRuleEditor
          label="书名 *"
          rule={data.list_novel_name}
          onChange={(r) => patchRule("list_novel_name", r)}
          aiEnabled={aiEnabled}
          onAiRequest={() => runFieldAi("list_novel_name", "书名")}
          aiLoading={aiLoading === "list_novel_name"}
          html={data.update_list_html || undefined}
        />
        <FieldRuleEditor
          label="书籍链接 *"
          rule={data.list_release_url}
          onChange={(r) => patchRule("list_release_url", r)}
          aiEnabled={aiEnabled}
          onAiRequest={() => runFieldAi("list_release_url", "书籍链接")}
          aiLoading={aiLoading === "list_release_url"}
          html={data.update_list_html || undefined}
        />
        <FieldRuleEditor
          label="更新日期"
          rule={data.list_release_date}
          onChange={(r) => patchRule("list_release_date", r)}
          aiEnabled={aiEnabled}
          onAiRequest={() => runFieldAi("list_release_date", "更新日期")}
          aiLoading={aiLoading === "list_release_date"}
          html={data.update_list_html || undefined}
        />
      </WizardSection>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      <PaginationSection
        data={data}
        onChange={onChange}
        badge={data.has_pagination && paginationDetected ? "已自动检测" : undefined}
        aiEnabled={aiEnabled}
        onAiAnalyze={runPaginationAi}
        aiLoading={aiLoading === "pagination"}
      />

      {/* ── Book name (optional) ────────────────────────────────────────── */}
      <WizardSection title="书籍名称 XPath（可选）" color="var(--color-text-muted)">
        <BookNameConfig
          data={data}
          onChange={onChange}
          bookNamePreview={bookNamePreview}
          bookNameTest={bookNameTest}
          testBookName={testBookName}
        />
      </WizardSection>

      {/* ── Live book list preview ──────────────────────────────────────── */}
      {bookCount > 0 && <BookListPreview books={data.update_books} />}

      {/* ── No result hint ──────────────────────────────────────────────── */}
      {data.update_list_html && bookCount === 0 && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            规则尚未命中书籍列表，请在底部点「XPath 工具」或手动填写规则，命中后书籍会自动出现在这里
          </span>
        </div>
      )}
    </div>
  );
}

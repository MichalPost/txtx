/**
 * 目录页 — 合并步骤
 *
 * 输入目录 URL → 获取 HTML → 配置规则（书名/章节链接/日期）→ 实时预览章节列表
 * 与 WizardStep1UpdateList 结构完全对称。
 */
import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Link2, Search, Loader2, CheckCircle2, AlertCircle,
  RefreshCw, ChevronDown, ChevronUp,
  Sparkles, Code2, TestTube2,
} from "lucide-react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { FieldRuleEditor } from "./FieldRuleEditor";
import { apiFetchSource } from "@/lib/api/files";
import { aiComplete, preprocessHtml, extractJson, validateXPath } from "@/lib/ai";
import { useAiStore } from "@/store/aiStore";
import { buildXPathFromRule, detectCharset } from "./ruleUtils";
import type { WizardData, FieldRule, ChapterListItem } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

type FetchStatus = "idle" | "loading" | "ok" | "error";

// ─── Preset common chapter-link rules ─────────────────────────────────────────

const COMMON_URL_RULES = [
  { label: "-- 常用链接规则 --", value: "" },
  { label: "li > a href",                     value: "//li/a/@href" },
  { label: "ul li a href",                    value: "//ul/li/a/@href" },
  { label: "div.list a href",                 value: "//div[contains(@class,'list')]//a/@href" },
  { label: "div.chapter a href",              value: "//div[contains(@class,'chapter')]//a/@href" },
  { label: "div.catalog a href",              value: "//div[contains(@class,'catalog')]//a/@href" },
  { label: "dl dd a href",                    value: "//dl//dd/a/@href" },
  { label: "table td a href",                 value: "//table//td/a/@href" },
];

const AI_SYSTEM = `你是专门分析中文小说网站 HTML 结构的专家。
分析目录页HTML，为以下3个字段生成XPath，严格输出JSON，不含其他内容：
{
  "list_novel_name":   {"xpath":"...","explanation":"..."},
  "list_release_date": {"xpath":"...","explanation":"..."},
  "list_release_url":  {"xpath":"...","explanation":"..."}
}
规则：优先用 id/class 属性，文本加 /text()，链接加 /@href，用 // 全局路径。无把握的字段 xpath 留空字符串。`;

// ─── XPath eval helper ────────────────────────────────────────────────────────

function evalXPathAll(html: string, xpath: string): string[] {
  if (!xpath || !html) return [];
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const snap = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const out: string[] = [];
    for (let i = 0; i < snap.snapshotLength; i++) {
      const node = snap.snapshotItem(i);
      const v = (node?.textContent ?? (node as Attr | null)?.value ?? "").trim();
      if (v) out.push(v);
    }
    return out;
  } catch { return []; }
}

function resolveUrl(href: string, base: string): string {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  try { return new URL(href, base).href; } catch { return href; }
}

/** Re-parse chapter list from current rules + HTML */
function reparseChapters(data: WizardData): ChapterListItem[] {
  const html = data.catalog_html;
  if (!html) return [];
  const titleXPath = buildXPathFromRule(data.list_novel_name);
  const urlXPath   = buildXPathFromRule(data.list_release_url);
  const dateXPath  = buildXPathFromRule(data.list_release_date);
  if (!urlXPath) return [];
  const titles = titleXPath ? evalXPathAll(html, titleXPath) : [];
  const urls   = evalXPathAll(html, urlXPath);
  const dates  = dateXPath ? evalXPathAll(html, dateXPath) : [];
  return urls
    .map((rawUrl, i) => ({
      title: titles[i]?.trim() || `章节 ${i + 1}`,
      url:   resolveUrl(rawUrl.trim(), data.catalog_url),
      date:  dates[i]?.trim(),
    }))
    .filter((c) => c.url);
}

function applyAiResult(existing: FieldRule, result?: { xpath?: string }): FieldRule {
  const xpath = result?.xpath ?? "";
  if (!xpath) return existing;
  return { ...existing, mode: "ai", xpath };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function WizardStepCatalog({ data, onChange }: Props) {
  const navigate = useNavigate();
  const aiEnabled = useAiStore((s) => s.config.enabled);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>(
    data.catalog_html ? "ok" : "idle",
  );
  const [fetchError, setFetchError]   = useState("");
  const [aiLoading, setAiLoading]     = useState<string | null>(null);
  const [aiError, setAiError]         = useState("");
  const [showSource, setShowSource]   = useState(false);
  const [autoMatchLoading, setAutoMatchLoading] = useState(false);

  // Book name test
  const [bookNameTest, setBookNameTest] = useState<{ count: number; sample: string } | null>(null);

  // ── Fetch HTML ──────────────────────────────────────────────────────────────

  const handleFetch = async () => {
    const url = data.catalog_url.trim();
    if (!url || url === "https://") return;
    setFetchStatus("loading");
    setFetchError("");
    try {
      const html = await apiFetchSource(url);
      const detectedEncoding = detectCharset(html);
      const chapters = reparseChapters({ ...data, catalog_html: html });
      const firstUrl = chapters[0]?.url ?? data.chapter_test_url;
      onChange({
        ...data,
        catalog_html: html,
        chapter_items: chapters,
        chapter_test_url: firstUrl,
        encoding: data.encoding || detectedEncoding,
      });
      setFetchStatus("ok");
    } catch (e) {
      setFetchError(String(e));
      setFetchStatus("error");
    }
  };

  const ensureHtml = async (): Promise<string> => {
    if (data.catalog_html) return data.catalog_html;
    const url = data.catalog_url.trim();
    if (!url || url === "https://") throw new Error("请先填写目录页链接");
    const html = await apiFetchSource(url);
    const detectedEncoding = detectCharset(html);
    onChange({ ...data, catalog_html: html, encoding: data.encoding || detectedEncoding });
    return html;
  };

  // ── Rule patch helper — re-parses chapters ─────────────────────────────────

  const patchRule = useCallback((
    key: "list_novel_name" | "list_release_date" | "list_release_url",
    rule: FieldRule,
  ) => {
    const next = { ...data, [key]: rule };
    const chapters = reparseChapters(next);
    const firstUrl = chapters[0]?.url ?? next.chapter_test_url;
    onChange({ ...next, chapter_items: chapters, chapter_test_url: firstUrl });
  }, [data, onChange]);

  // ── Auto-match chapter links ────────────────────────────────────────────────

  const runAutoMatch = async () => {
    setAutoMatchLoading(true);
    setAiError("");
    try {
      const html = await ensureHtml();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const candidates = [
        "//div[contains(@class,'list')]//a/@href",
        "//div[contains(@class,'chapter')]//a/@href",
        "//div[contains(@class,'catalog')]//a/@href",
        "//ul[contains(@class,'list')]//a/@href",
        "//ul//li/a/@href",
        "//dl//dd/a/@href",
        "//table//td/a/@href",
      ];
      let bestXpath = "";
      let bestCount = 0;
      for (const xpath of candidates) {
        try {
          const snap = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (snap.snapshotLength > bestCount) { bestCount = snap.snapshotLength; bestXpath = xpath; }
        } catch { /* skip */ }
      }
      const rule: FieldRule = { ...data.list_release_url, mode: "xpath", xpath: bestXpath || data.list_release_url.xpath };
      const next = { ...data, catalog_html: html, list_release_url: rule };
      const chapters = reparseChapters(next);
      onChange({ ...next, chapter_items: chapters, chapter_test_url: chapters[0]?.url ?? next.chapter_test_url });
    } catch (e) { setAiError(String(e)); }
    finally { setAutoMatchLoading(false); }
  };

  // ── AI batch ────────────────────────────────────────────────────────────────

  const runBatchAi = async () => {
    if (!aiEnabled) return;
    setAiLoading("batch");
    setAiError("");
    try {
      const html = await ensureHtml();
      const aiConfig = useAiStore.getState().activeConfig();
      const processed = preprocessHtml(html);
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n分析以下目录页 HTML，为3个字段生成 XPath：\n${processed}`,
        AI_SYSTEM, aiConfig,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;
      const next: WizardData = {
        ...data,
        catalog_html: html,
        list_novel_name:   applyAiResult(data.list_novel_name,   parsed?.list_novel_name),
        list_release_date: applyAiResult(data.list_release_date, parsed?.list_release_date),
        list_release_url:  applyAiResult(data.list_release_url,  parsed?.list_release_url),
      };
      const chapters = reparseChapters(next);
      onChange({ ...next, chapter_items: chapters, chapter_test_url: chapters[0]?.url ?? next.chapter_test_url });
    } catch (e) { setAiError(String(e)); }
    finally { setAiLoading(null); }
  };

  const runFieldAi = async (
    key: "list_novel_name" | "list_release_date" | "list_release_url",
    label: string,
  ) => {
    if (!aiEnabled) return;
    setAiLoading(key);
    setAiError("");
    try {
      const html = await ensureHtml();
      const aiConfig = useAiStore.getState().activeConfig();
      const processed = preprocessHtml(html);
      const system = `你是专门分析中文小说网站HTML结构的专家。
为字段"${label}"生成最合适的XPath，严格输出JSON：{"xpath":"...","explanation":"..."}
文本加/text()，链接加/@href。`;
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n分析HTML，为"${label}"字段生成XPath：\n${processed}`,
        system, aiConfig,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;
      const xpath: string = parsed?.xpath ?? "";
      const rule: FieldRule = { ...data[key], mode: "ai", xpath };
      const next = { ...data, catalog_html: html, [key]: rule };
      const chapters = reparseChapters(next);
      onChange({ ...next, chapter_items: chapters, chapter_test_url: chapters[0]?.url ?? next.chapter_test_url });
    } catch (e) { setAiError(String(e)); }
    finally { setAiLoading(null); }
  };

  // ── Book name test ───────────────────────────────────────────────────────────

  const bookNamePreview = useMemo(() => buildBookNameXPath(data), [data]);

  const testBookName = () => {
    if (!data.catalog_html) { setAiError("请先获取页面"); return; }
    const xpath = bookNamePreview;
    if (!xpath) { setBookNameTest(null); return; }
    const v = validateXPath(data.catalog_html, xpath);
    setBookNameTest({ count: v.count, sample: v.samples[0] ?? "" });
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const htmlSize = data.catalog_html
    ? `${(data.catalog_html.length / 1024).toFixed(1)} KB`
    : null;

  const chapterCount = data.chapter_items.length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">

      {/* ── Instruction ─────────────────────────────────────────────────── */}
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3"
        style={{ background: "var(--color-accent-muted)", borderLeft: "2px solid var(--color-accent)" }}
      >
        <Link2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--color-accent)" }} />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>
            第三步：目录页规则
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            填写某本书的目录页地址，获取后配置章节名称、章节链接、更新日期三条规则。解析正确后章节列表会实时显示，下一步直接进入章节页配置。
          </p>
        </div>
      </div>

      {/* ── URL + fetch ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            label="目录页链接"
            placeholder="https://example.com/novel/12345/"
            value={data.catalog_url}
            onChange={(e) => {
              onChange({ ...data, catalog_url: e.target.value, catalog_html: "", chapter_items: [] });
              setFetchStatus("idle");
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleFetch(); }}
          />
        </div>
        <Button
          size="sm"
          variant={fetchStatus === "ok" ? "secondary" : "primary"}
          onClick={handleFetch}
          disabled={fetchStatus === "loading" || !data.catalog_url.trim() || data.catalog_url === "https://"}
        >
          {fetchStatus === "loading"
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Search className="w-3.5 h-3.5" />
          }
          {fetchStatus === "loading" ? "获取中..." : "获取页面"}
        </Button>
      </div>

      {/* Fetch status */}
      {fetchStatus === "ok" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          页面获取成功（{htmlSize}），已缓存，可配置下方规则
        </div>
      )}
      {fetchStatus === "error" && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{fetchError || "页面请求失败，请检查网址"}</span>
        </div>
      )}

      {/* ── Quick tools row ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Auto match */}
        <Button size="sm" variant="secondary" onClick={runAutoMatch} disabled={autoMatchLoading}>
          {autoMatchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          自动匹配链接
        </Button>

        {/* Common URL rules dropdown */}
        <select
          className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none"
          style={{
            background: "var(--color-surface-1)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
            flex: "1 1 160px", minWidth: 0,
          }}
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const rule: FieldRule = { ...data.list_release_url, mode: "xpath", xpath: v };
            const next = { ...data, list_release_url: rule };
            const chapters = reparseChapters(next);
            onChange({ ...next, chapter_items: chapters, chapter_test_url: chapters[0]?.url ?? next.chapter_test_url });
          }}
        >
          {COMMON_URL_RULES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        {/* View source */}
        <button
          onClick={async () => {
            if (!data.catalog_html) { try { await ensureHtml(); } catch { /* ignore */ } }
            setShowSource((v) => !v);
          }}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors shrink-0"
          style={{
            background: showSource ? "var(--color-accent-muted)" : "var(--color-surface-1)",
            borderColor: showSource
              ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
              : "var(--color-border)",
            color: showSource ? "var(--color-accent)" : "var(--color-text-muted)",
          }}
        >
          <Code2 className="w-3 h-3" />
          源码
        </button>

        {/* AI batch */}
        {aiEnabled ? (
          <Button size="sm" onClick={runBatchAi} disabled={aiLoading !== null}>
            {aiLoading === "batch" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {aiLoading === "batch" ? "AI 分析中..." : "AI 批量分析"}
          </Button>
        ) : (
          <button
            onClick={() => navigate("/settings?tab=ai")}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors shrink-0"
            style={{
              background: "var(--color-surface-1)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-subtle)",
            }}
          >
            <Sparkles className="w-3 h-3" style={{ color: "var(--color-text-subtle)" }} />
            AI 未启用（点此开启）
          </button>
        )}
      </div>

      {/* Source preview */}
      {showSource && data.catalog_html && (
        <div
          className="rounded-lg border overflow-auto font-mono text-xs leading-relaxed p-2"
          style={{
            background: "var(--color-surface-2)", borderColor: "var(--color-border)",
            maxHeight: 160, color: "var(--color-text-muted)",
            whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}
        >
          {data.catalog_html.slice(0, 8000)}
          {data.catalog_html.length > 8000 && "\n\n… 已截断（仅显示前 8000 字符）"}
        </div>
      )}

      {/* AI / general error */}
      {aiError && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{aiError}</span>
        </div>
      )}

      {/* ── Rule editors ────────────────────────────────────────────────── */}
      <Section title="目录规则（必填）" color="var(--color-danger)">
        <FieldRuleEditor
          label="章节名称 *"
          rule={data.list_novel_name}
          onChange={(r) => patchRule("list_novel_name", r)}
          aiEnabled={aiEnabled}
          onAiRequest={() => runFieldAi("list_novel_name", "章节名称")}
          aiLoading={aiLoading === "list_novel_name"}
          html={data.catalog_html || undefined}
        />
        <FieldRuleEditor
          label="章节链接 *"
          rule={data.list_release_url}
          onChange={(r) => patchRule("list_release_url", r)}
          aiEnabled={aiEnabled}
          onAiRequest={() => runFieldAi("list_release_url", "章节链接")}
          aiLoading={aiLoading === "list_release_url"}
          html={data.catalog_html || undefined}
        />
        <FieldRuleEditor
          label="更新日期"
          rule={data.list_release_date}
          onChange={(r) => patchRule("list_release_date", r)}
          aiEnabled={aiEnabled}
          onAiRequest={() => runFieldAi("list_release_date", "更新日期")}
          aiLoading={aiLoading === "list_release_date"}
          html={data.catalog_html || undefined}
        />
      </Section>

      {/* ── Book name (optional) ────────────────────────────────────────── */}
      <Section title="书籍名称 XPath（可选）" color="var(--color-text-muted)">
        <BookNameConfig
          data={data}
          onChange={onChange}
          bookNamePreview={bookNamePreview}
          bookNameTest={bookNameTest}
          testBookName={testBookName}
        />
      </Section>

      {/* ── Live chapter list preview ────────────────────────────────────── */}
      {chapterCount > 0 && (
        <ChapterListPreview
          chapters={data.chapter_items}
          selectedUrl={data.chapter_test_url}
          onSelect={(item) => onChange({
            ...data,
            chapter_test_url: item.url,
            selected_chapter_title: item.title,
            chapter_html: "",
          })}
        />
      )}

      {/* ── No result hint ──────────────────────────────────────────────── */}
      {data.catalog_html && chapterCount === 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}>
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            规则尚未命中章节列表，请点底部「XPath 工具」或手动填写规则，命中后章节列表会自动出现
          </span>
        </div>
      )}

    </div>
  );
}

// ─── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, color = "var(--color-text-muted)", children }: {
  title: string; color?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl p-3 border"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <p className="text-xs font-semibold" style={{ color }}>{title}</p>
      {children}
    </div>
  );
}

// ─── BookNameConfig ────────────────────────────────────────────────────────────

function BookNameConfig({ data, onChange, bookNamePreview, bookNameTest, testBookName }: {
  data: WizardData;
  onChange: (d: WizardData) => void;
  bookNamePreview: string;
  bookNameTest: { count: number; sample: string } | null;
  testBookName: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={data.book_name_use_xpath}
          onChange={(e) => onChange({ ...data, book_name_use_xpath: e.target.checked })}
          className="w-3.5 h-3.5 rounded"
        />
        <span className="text-xs" style={{ color: "var(--color-text)" }}>使用 XPath 提取书名</span>
        {bookNamePreview && (
          <code className="text-xs font-mono ml-2 px-2 py-0.5 rounded"
            style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}>
            {bookNamePreview}
          </code>
        )}
      </label>
      <div className="flex gap-2 flex-wrap items-end">
        {["h1", "h2", "h3", "h4", "div", "span", "p", "title"].map((t) => (
          <button
            key={t}
            onClick={() => onChange({ ...data, book_name_tag: t })}
            className="text-xs px-2 py-1 rounded border transition-colors"
            style={{
              background: data.book_name_tag === t ? "var(--color-accent-muted)" : "var(--color-surface-1)",
              borderColor: data.book_name_tag === t
                ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
                : "var(--color-border)",
              color: data.book_name_tag === t ? "var(--color-accent)" : "var(--color-text-muted)",
            }}
          >
            {t}
          </button>
        ))}
        <div className="flex-1" style={{ minWidth: 80 }}>
          <Input
            placeholder="属性值，如 bookname"
            value={data.book_name_val}
            onChange={(e) => onChange({ ...data, book_name_val: e.target.value })}
          />
        </div>
        <button
          onClick={testBookName}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors shrink-0"
          style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)", color: "var(--color-accent)" }}
        >
          <TestTube2 className="w-3 h-3" />
          测试
        </button>
      </div>
      {bookNameTest !== null && (
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
          style={{
            background: bookNameTest.count > 0 ? "var(--color-success-bg)" : "var(--color-warning-bg)",
            color: bookNameTest.count > 0 ? "var(--color-success)" : "var(--color-warning)",
          }}>
          命中 {bookNameTest.count} 个
          {bookNameTest.sample && (
            <span style={{ color: "var(--color-text-muted)" }}>— {bookNameTest.sample}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ChapterListPreview ───────────────────────────────────────────────────────

function ChapterListPreview({
  chapters, selectedUrl, onSelect,
}: {
  chapters: ChapterListItem[];
  selectedUrl: string;
  onSelect: (item: ChapterListItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? chapters : chapters.slice(0, 6);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold flex-1" style={{ color: "var(--color-text)" }}>
          实时解析预览
        </p>
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
          <CheckCircle2 className="w-2.5 h-2.5 inline mr-1" />
          {chapters.length} 章
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {visible.map((c, i) => {
          const selected = c.url === selectedUrl;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(c)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border text-left transition-all"
              style={{
                background: selected
                  ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))"
                  : "var(--color-surface-1)",
                borderColor: selected ? "var(--color-accent)" : "var(--color-border)",
              }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                style={{
                  background: selected ? "var(--color-accent)" : "var(--color-surface-2)",
                  color: selected ? "#fff" : "var(--color-text-subtle)",
                }}
              >
                {i + 1}
              </span>
              <span className="font-medium flex-1 truncate"
                style={{ color: selected ? "var(--color-accent)" : "var(--color-text)" }}>
                {c.title}
              </span>
              {c.date && (
                <span className="shrink-0" style={{ color: "var(--color-text-subtle)" }}>
                  {c.date}
                </span>
              )}
              <span
                className="truncate font-mono shrink-0 max-w-[30%]"
                style={{ color: "var(--color-text-subtle)", fontSize: 10 }}
                title={c.url}
              >
                {c.url.replace(/^https?:\/\/[^/]+/, "")}
              </span>
            </button>
          );
        })}
      </div>
      {chapters.length > 6 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 self-start text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          {expanded
            ? <><ChevronUp className="w-3 h-3" />收起</>
            : <><ChevronDown className="w-3 h-3" />展开全部 {chapters.length} 章</>
          }
        </button>
      )}
      <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
        ✓ 点击章节可选为测试章节，下一步将用其配置章节页规则
      </p>
    </div>
  );
}

// ─── Book name XPath builder ───────────────────────────────────────────────────

function buildBookNameXPath(data: WizardData): string {
  if (!data.book_name_use_xpath) return "";
  const tag = data.book_name_tag || "*";
  const attr = data.book_name_attr;
  const val = data.book_name_val.trim();
  if (attr && val) return `//${tag}[@${attr}="${val}"]/text()`;
  if (attr)        return `//${tag}[@${attr}]/text()`;
  return `//${tag}/text()`;
}

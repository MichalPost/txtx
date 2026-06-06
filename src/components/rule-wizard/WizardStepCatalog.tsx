/**
 * 目录页 — 合并步骤
 *
 * 输入目录 URL → 获取 HTML → 配置规则（书名/章节链接/日期）→ 实时预览章节列表
 */
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { validateXPath } from "@/lib/ai";
import { apiFetchSource } from "@/lib/api/files";

import { BookNameConfig, buildBookNameXPath } from "./components/BookNameConfig";
import { ChapterListPreview } from "./components/ChapterListPreview";
import { WizardSection } from "./components/WizardSection";
import { FieldRuleEditor } from "./FieldRuleEditor";
import { useCatalogAi } from "./hooks/useCatalogAi";
import { buildXPathFromRule, detectCharset, type FieldRule, type WizardData } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

type FetchStatus = "idle" | "loading" | "ok" | "error";

const COMMON_URL_RULES = [
  { label: "-- 常用链接规则 --", value: "" },
  { label: "li > a href", value: "//li/a/@href" },
  { label: "ul li a href", value: "//ul/li/a/@href" },
  { label: "div.list a href", value: "//div[contains(@class,'list')]//a/@href" },
  { label: "div.chapter a href", value: "//div[contains(@class,'chapter')]//a/@href" },
  { label: "div.catalog a href", value: "//div[contains(@class,'catalog')]//a/@href" },
  { label: "dl dd a href", value: "//dl//dd/a/@href" },
  { label: "table td a href", value: "//table//td/a/@href" },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export function WizardStepCatalog({ data, onChange }: Props) {
  const navigate = useNavigate();
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>(data.catalog_html ? "ok" : "idle");
  const [fetchError, setFetchError] = useState("");
  const [showSource, setShowSource] = useState(false);
  const [autoMatchLoading, setAutoMatchLoading] = useState(false);
  const [bookNameTest, setBookNameTest] = useState<{ count: number; sample: string } | null>(null);

  // ── Fetch HTML ──────────────────────────────────────────────────────────────

  const ensureHtml = async (): Promise<string> => {
    if (data.catalog_html) return data.catalog_html;
    const url = data.catalog_url.trim();
    if (!url || url === "https://") throw new Error("请先填写目录页链接");
    const html = await apiFetchSource(url);
    const detectedEncoding = detectCharset(html);
    onChange({ ...data, catalog_html: html, encoding: data.encoding || detectedEncoding });
    return html;
  };

  const handleFetch = async () => {
    const url = data.catalog_url.trim();
    if (!url || url === "https://") return;
    setFetchStatus("loading");
    setFetchError("");
    try {
      const { evalXPathAll, resolveUrl } = await import("./utils/xpathEval");
      const html = await apiFetchSource(url);
      const detectedEncoding = detectCharset(html);

      // inline reparseChapters to avoid circular dependency with hook
      const titleXPath = buildXPathFromRule(data.list_novel_name);
      const urlXPath = buildXPathFromRule(data.list_release_url);
      const dateXPath = buildXPathFromRule(data.list_release_date);
      const titles = titleXPath ? evalXPathAll(html, titleXPath) : [];
      const urls = urlXPath ? evalXPathAll(html, urlXPath) : [];
      const dates = dateXPath ? evalXPathAll(html, dateXPath) : [];
      const chapters = urls
        .map((rawUrl, i) => ({
          title: titles[i]?.trim() || `章节 ${i + 1}`,
          url: resolveUrl(rawUrl.trim(), url),
          date: dates[i]?.trim(),
        }))
        .filter((c) => c.url);

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

  // ── AI hook ────────────────────────────────────────────────────────────────

  const { aiEnabled, aiLoading, aiError, setAiError, runBatchAi, runFieldAi } = useCatalogAi(
    data,
    onChange,
    ensureHtml,
  );

  // ── Rule patch helper ──────────────────────────────────────────────────────

  const patchRule = useCallback(
    async (key: "list_novel_name" | "list_release_date" | "list_release_url", rule: FieldRule) => {
      const { evalXPathAll, resolveUrl } = await import("./utils/xpathEval");
      const next = { ...data, [key]: rule };
      const html = next.catalog_html;
      if (!html) {
        onChange(next);
        return;
      }
      const titleXPath = buildXPathFromRule(next.list_novel_name);
      const urlXPath = buildXPathFromRule(next.list_release_url);
      const dateXPath = buildXPathFromRule(next.list_release_date);
      const titles = titleXPath ? evalXPathAll(html, titleXPath) : [];
      const urls = urlXPath ? evalXPathAll(html, urlXPath) : [];
      const dates = dateXPath ? evalXPathAll(html, dateXPath) : [];
      const chapters = urls
        .map((rawUrl, i) => ({
          title: titles[i]?.trim() || `章节 ${i + 1}`,
          url: resolveUrl(rawUrl.trim(), next.catalog_url),
          date: dates[i]?.trim(),
        }))
        .filter((c) => c.url);
      const firstUrl = chapters[0]?.url ?? next.chapter_test_url;
      onChange({ ...next, chapter_items: chapters, chapter_test_url: firstUrl });
    },
    [data, onChange],
  );

  // ── Auto-match ─────────────────────────────────────────────────────────────

  const runAutoMatch = async () => {
    setAutoMatchLoading(true);
    setAiError("");
    try {
      const { evalXPathAll, resolveUrl } = await import("./utils/xpathEval");
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
      const next = { ...data, catalog_html: html, list_release_url: rule };
      const urlXPath = buildXPathFromRule(next.list_release_url);
      const urls = urlXPath ? evalXPathAll(html, urlXPath) : [];
      const chapters = urls
        .map((rawUrl, i) => ({
          title: `章节 ${i + 1}`,
          url: resolveUrl(rawUrl.trim(), next.catalog_url),
          date: undefined,
        }))
        .filter((c) => c.url);
      onChange({
        ...next,
        chapter_items: chapters,
        chapter_test_url: chapters[0]?.url ?? next.chapter_test_url,
      });
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAutoMatchLoading(false);
    }
  };

  // ── Book name test ───────────────────────────────────────────────────────────

  const bookNamePreview = useMemo(() => buildBookNameXPath(data), [data]);

  const testBookName = () => {
    if (!data.catalog_html) {
      setAiError("请先获取页面");
      return;
    }
    const xpath = bookNamePreview;
    if (!xpath) {
      setBookNameTest(null);
      return;
    }
    const v = validateXPath(data.catalog_html, xpath);
    setBookNameTest({ count: v.count, sample: v.samples[0] ?? "" });
  };

  const htmlSize = data.catalog_html ? `${(data.catalog_html.length / 1024).toFixed(1)} KB` : null;
  const chapterCount = data.chapter_items.length;

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
        <Link2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
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
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="目录页链接"
            placeholder="https://example.com/novel/12345/"
            value={data.catalog_url}
            onChange={(e) => {
              onChange({
                ...data,
                catalog_url: e.target.value,
                catalog_html: "",
                chapter_items: [],
              });
              setFetchStatus("idle");
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
            fetchStatus === "loading" || !data.catalog_url.trim() || data.catalog_url === "https://"
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

      {fetchStatus === "ok" && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          页面获取成功（{htmlSize}），已缓存，可配置下方规则
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
            flex: "1 1 160px",
            minWidth: 0,
          }}
          value=""
          onChange={async (e) => {
            const v = e.target.value;
            if (!v) return;
            await patchRule("list_release_url", {
              ...data.list_release_url,
              mode: "xpath",
              xpath: v,
            });
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
            if (!data.catalog_html) {
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

      {showSource && data.catalog_html && (
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
          {data.catalog_html.slice(0, 8000)}
          {data.catalog_html.length > 8000 && "\n\n… 已截断（仅显示前 8000 字符）"}
        </div>
      )}

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
      <WizardSection title="目录规则（必填）" color="var(--color-danger)">
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
      </WizardSection>

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

      {/* ── Live chapter list preview ────────────────────────────────────── */}
      {chapterCount > 0 && (
        <ChapterListPreview
          chapters={data.chapter_items}
          selectedUrl={data.chapter_test_url}
          onSelect={(item) =>
            onChange({
              ...data,
              chapter_test_url: item.url,
              selected_chapter_title: item.title,
              chapter_html: "",
            })
          }
        />
      )}

      {/* ── No result hint ──────────────────────────────────────────────── */}
      {data.catalog_html && chapterCount === 0 && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            规则尚未命中章节列表，请点底部「XPath 工具」或手动填写规则，命中后章节列表会自动出现
          </span>
        </div>
      )}
    </div>
  );
}

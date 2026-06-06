/**
 * Step 5 — 章节规则
 * 核心：获取章节页 → 配置正文内容规则（可点击预览命中结果）
 * 高级选项折叠：详情页书名 / 章节链接 / 章节内分页 / 备用规则
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { aiComplete, extractJson, preprocessHtml } from "@/lib/ai";
import { apiFetchSource } from "@/lib/api/files";
import { useAiStore } from "@/store/aiStore";

import { FieldRuleEditor } from "./FieldRuleEditor";
import type { FieldRule, WizardData } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

type FetchStatus = "idle" | "loading" | "ok" | "error";

const AI_SYSTEM = `你是专门分析中文小说网站 HTML 结构的专家。
分析章节页HTML，为以下字段生成XPath，严格输出JSON，不含其他内容：
{
  "chap_novel_name":  {"xpath":"...","explanation":"..."},
  "chap_chapter_url": {"xpath":"...","explanation":"..."},
  "chap_content":     {"xpath":"...","explanation":"..."},
  "chap_next_page":   {"xpath":"...","explanation":"..."}
}
规则：正文内容优先用 id="content" 或 class 含 content/txt/text 的 div，文本加 /text()。
章节内分页(chap_next_page)：找"下一页"链接，用/@href，没有分页则留空字符串。`;

function applyAiResult(existing: FieldRule, result?: { xpath?: string }): FieldRule {
  const xpath = result?.xpath ?? "";
  if (!xpath) return existing;
  return { ...existing, mode: "ai", xpath };
}

// ─── Auto-detect chapter next-page link ──────────────────────────────────────

function detectNextPageXPath(html: string): string {
  if (!html) return "";
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const candidates = [
      '//a[contains(text(),"下一页")]/@href',
      '//a[contains(text(),"下页")]/@href',
      '//a[contains(@class,"next")]/@href',
      '//a[contains(@id,"next")]/@href',
      '//a[@rel="next"]/@href',
      '//a[contains(@class,"nextpage")]/@href',
      '//a[contains(@class,"page-next")]/@href',
    ];
    for (const xpath of candidates) {
      try {
        const r = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const val = (r.singleNodeValue as Attr | null)?.value?.trim();
        if (val && val !== "#" && !val.startsWith("javascript")) return xpath;
      } catch {
        /* skip */
      }
    }
  } catch {
    /* ignore */
  }
  return "";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WizardStep4ChapRules({ data, onChange }: Props) {
  const navigate = useNavigate();
  const aiEnabled = useAiStore((s) => s.config.enabled);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [newFallback, setNewFallback] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(Boolean(data.chapter_next_page_xpath));
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>(data.chapter_html ? "ok" : "idle");
  const [fetchError, setFetchError] = useState("");
  const [nextPageDetected, setNextPageDetected] = useState(false);

  const chapterUrl = data.chapter_test_url || data.catalog_url;

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const handleFetch = async () => {
    const url = chapterUrl.trim();
    if (!url || url === "https://") return;
    setFetchStatus("loading");
    setFetchError("");
    setNextPageDetected(false);
    try {
      const html = await apiFetchSource(url);
      let nextPageXPath = data.chapter_next_page_xpath;
      let detected = false;
      if (!nextPageXPath) {
        nextPageXPath = detectNextPageXPath(html);
        if (nextPageXPath) detected = true;
      }
      onChange({
        ...data,
        chapter_html: html,
        chapter_test_url: url,
        chapter_next_page_xpath: nextPageXPath,
      });
      setFetchStatus("ok");
      if (detected) {
        setNextPageDetected(true);
        setShowAdvanced(true);
      }
    } catch (e) {
      setFetchError(String(e));
      setFetchStatus("error");
    }
  };

  const ensureChapHtml = async (): Promise<string> => {
    if (data.chapter_html) return data.chapter_html;
    const url = chapterUrl.trim();
    if (!url || url === "https://") throw new Error("请先获取章节页面");
    const html = await apiFetchSource(url);
    onChange({ ...data, chapter_html: html, chapter_test_url: url });
    setFetchStatus("ok");
    return html;
  };

  // ── AI ──────────────────────────────────────────────────────────────────────

  const runBatchAi = async () => {
    if (!aiEnabled) return;
    setAiLoading("batch");
    setErrorMsg("");
    try {
      const html = await ensureChapHtml();
      const aiConfig = useAiStore.getState().activeConfig();
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n分析以下章节页 HTML，生成字段的 XPath：\n${preprocessHtml(html)}`,
        AI_SYSTEM,
        aiConfig,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;
      const nextPageXPath: string = parsed?.chap_next_page?.xpath ?? "";
      onChange({
        ...data,
        chapter_html: html,
        chap_novel_name: applyAiResult(data.chap_novel_name, parsed?.chap_novel_name),
        chap_chapter_url: applyAiResult(data.chap_chapter_url, parsed?.chap_chapter_url),
        chap_content: applyAiResult(data.chap_content, parsed?.chap_content),
        chapter_next_page_xpath: nextPageXPath || data.chapter_next_page_xpath,
      });
      if (nextPageXPath) setShowAdvanced(true);
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setAiLoading(null);
    }
  };

  const runFieldAi = async (
    fieldKey: "chap_novel_name" | "chap_chapter_url" | "chap_content",
    fieldLabel: string,
  ) => {
    if (!aiEnabled) return;
    setAiLoading(fieldKey);
    setErrorMsg("");
    try {
      const html = await ensureChapHtml();
      const aiConfig = useAiStore.getState().activeConfig();
      const system = `你是专门分析中文小说网站HTML结构的专家。为字段"${fieldLabel}"生成最合适的XPath，严格输出JSON：{"xpath":"...","explanation":"..."}文本加/text()，链接加/@href。`;
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n分析以下章节页HTML，为"${fieldLabel}"字段生成XPath：\n${preprocessHtml(html)}`,
        system,
        aiConfig,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;
      onChange({
        ...data,
        chapter_html: html,
        [fieldKey]: { ...data[fieldKey], mode: "ai", xpath: parsed?.xpath ?? "" } as FieldRule,
      });
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setAiLoading(null);
    }
  };

  const addFallback = () => {
    const v = newFallback.trim();
    if (!v) return;
    onChange({ ...data, chap_content_fallbacks: [...data.chap_content_fallbacks, v] });
    setNewFallback("");
  };

  const removeFallback = (i: number) => {
    onChange({
      ...data,
      chap_content_fallbacks: data.chap_content_fallbacks.filter((_, idx) => idx !== i),
    });
  };

  const htmlSize = data.chapter_html ? `${(data.chapter_html.length / 1024).toFixed(1)} KB` : null;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Instruction ─────────────────────────────────────────────────── */}
      <div
        className="rounded-xl px-4 py-3 text-xs"
        style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
      >
        <p className="mb-1 font-medium" style={{ color: "var(--color-text)" }}>
          第五步：设定章节页正文规则
        </p>
        <p>获取一个章节页，然后配置正文内容的 XPath 规则。正文内容为必填，其余为可选。</p>
      </div>

      {/* ── URL + fetch ─────────────────────────────────────────────────── */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="章节页地址（从上一步自动提取）"
            placeholder="https://example.com/novel/12345/1.html"
            value={chapterUrl}
            onChange={(e) => {
              onChange({ ...data, chapter_test_url: e.target.value, chapter_html: "" });
              setFetchStatus("idle");
              setNextPageDetected(false);
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
          disabled={fetchStatus === "loading" || !chapterUrl.trim() || chapterUrl === "https://"}
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
        <div className="flex flex-col gap-1.5">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            章节页获取成功（{htmlSize}），可配置下方规则
          </div>
          {nextPageDetected && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
              style={{
                background: "var(--color-accent-muted)",
                color: "var(--color-accent)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
              }}
            >
              <FileText className="h-3 w-3 shrink-0" />
              <span className="flex-1">已自动检测到章节内分页，「下一页」链接规则已填入</span>
              <button
                className="text-xs underline opacity-70 hover:opacity-100"
                onClick={() => {
                  onChange({ ...data, chapter_next_page_xpath: "" });
                  setNextPageDetected(false);
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

      {/* ── AI ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {aiEnabled ? (
          <Button size="sm" onClick={runBatchAi} disabled={aiLoading !== null}>
            {aiLoading === "batch" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {aiLoading === "batch" ? "AI 分析中..." : "AI 批量分析"}
          </Button>
        ) : (
          <button
            onClick={() => navigate("/settings?tab=ai")}
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
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

      {errorMsg && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── 正文内容（核心，必填）───────────────────────────────────────── */}
      <FieldRuleEditor
        label="正文内容 *"
        rule={data.chap_content}
        onChange={(r) => onChange({ ...data, chap_content: r })}
        aiEnabled={aiEnabled}
        onAiRequest={() => runFieldAi("chap_content", "正文内容")}
        aiLoading={aiLoading === "chap_content"}
        html={data.chapter_html || undefined}
      />

      {/* ── 高级选项折叠 ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-1.5 self-start rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
        style={{
          background: showAdvanced ? "var(--color-surface-2)" : "var(--color-surface-1)",
          borderColor: data.chapter_next_page_xpath
            ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
            : "var(--color-border)",
          color: data.chapter_next_page_xpath ? "var(--color-accent)" : "var(--color-text-muted)",
        }}
      >
        {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        高级选项（书名、章节链接、章节内分页、备用规则）
        {data.chapter_next_page_xpath && (
          <span
            className="ml-1 rounded-full px-1.5 py-0.5 text-[10px]"
            style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
          >
            已配置分页
          </span>
        )}
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-3">
          <FieldRuleEditor
            label="详情页书名"
            rule={data.chap_novel_name}
            onChange={(r) => onChange({ ...data, chap_novel_name: r })}
            aiEnabled={aiEnabled}
            onAiRequest={() => runFieldAi("chap_novel_name", "详情页书名")}
            aiLoading={aiLoading === "chap_novel_name"}
            html={data.chapter_html || undefined}
          />

          <FieldRuleEditor
            label="章节链接"
            rule={data.chap_chapter_url}
            onChange={(r) => onChange({ ...data, chap_chapter_url: r })}
            aiEnabled={aiEnabled}
            onAiRequest={() => runFieldAi("chap_chapter_url", "章节链接")}
            aiLoading={aiLoading === "chap_chapter_url"}
            html={data.chapter_html || undefined}
          />

          {/* ── 章节内分页 ─────────────────────────────────────────── */}
          <div
            className="flex flex-col gap-2 rounded-xl border p-3"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                章节内分页（可选）
              </span>
              {data.chapter_next_page_xpath && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-xs"
                  style={{
                    background: "var(--color-accent-muted)",
                    color: "var(--color-accent)",
                    fontSize: 10,
                  }}
                >
                  已启用
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              若章节被拆成多页，填入「下一页」链接的 XPath，下载时自动拼合所有子页内容（最多 20
              页）。
            </p>
            <Input
              placeholder='//a[contains(text(),"下一页")]/@href'
              value={data.chapter_next_page_xpath}
              onChange={(e) => onChange({ ...data, chapter_next_page_xpath: e.target.value })}
            />
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "下一页文字", xpath: '//a[contains(text(),"下一页")]/@href' },
                { label: "class=next", xpath: '//a[contains(@class,"next")]/@href' },
                { label: "rel=next", xpath: '//a[@rel="next"]/@href' },
              ].map((p) => (
                <button
                  key={p.xpath}
                  onClick={() => onChange({ ...data, chapter_next_page_xpath: p.xpath })}
                  className="rounded border px-2 py-0.5 text-xs transition-colors"
                  style={{
                    background:
                      data.chapter_next_page_xpath === p.xpath
                        ? "var(--color-accent-muted)"
                        : "var(--color-surface-1)",
                    borderColor:
                      data.chapter_next_page_xpath === p.xpath
                        ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
                        : "var(--color-border)",
                    color:
                      data.chapter_next_page_xpath === p.xpath
                        ? "var(--color-accent)"
                        : "var(--color-text-muted)",
                  }}
                >
                  {p.label}
                </button>
              ))}
              {data.chapter_next_page_xpath && (
                <button
                  onClick={() => onChange({ ...data, chapter_next_page_xpath: "" })}
                  className="rounded border px-2 py-0.5 text-xs transition-colors"
                  style={{
                    background: "var(--color-danger-bg)",
                    borderColor: "var(--color-danger)",
                    color: "var(--color-danger)",
                  }}
                >
                  清除
                </button>
              )}
            </div>
          </div>

          {/* ── 内容备用规则 ───────────────────────────────────────── */}
          <div
            className="flex flex-col gap-2 rounded-xl border p-3"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
          >
            <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
              内容备用规则（按顺序尝试）
            </span>
            {data.chap_content_fallbacks.map((fb, i) => (
              <div key={i} className="flex items-center gap-2">
                <code
                  className="flex-1 truncate font-mono text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {fb}
                </code>
                <button
                  onClick={() => removeFallback(i)}
                  className="flex h-5 w-5 items-center justify-center rounded hover:opacity-70"
                  style={{ color: "var(--color-danger)" }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  placeholder="//div[@id='content']/text()"
                  value={newFallback}
                  onChange={(e) => setNewFallback(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addFallback();
                  }}
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={addFallback}
                disabled={!newFallback.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
                添加
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

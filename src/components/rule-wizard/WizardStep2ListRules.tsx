/**
 * Step 4 — 目录规则
 * 对照参考截图的完整功能：
 * - 常用规则（快速选用）：自动匹配 + 常用规则下拉 + 编码选择 + 查看源码
 * - 规则设定（必填）：方式 / 标签名 / 属性名 / 值 / 正则
 * - 分页设置：存在分页 / 链接变化方式 / 分页总数 / 插入链接部分
 * - 书籍名称（可选）：使用 XPath / 标签名 / 属性名 / 值 + 测试按钮
 * - AI 批量分析（若开启）
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, Loader2, AlertCircle, Code2, RefreshCw, TestTube2,
} from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FieldRuleEditor } from "./FieldRuleEditor";
import { apiFetchSource } from "@/lib/api/files";
import { aiComplete, preprocessHtml, extractJson, validateXPath } from "@/lib/ai";
import { useAiStore } from "@/store/aiStore";
import type { WizardData, FieldRule } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

// ─── Preset common rules ───────────────────────────────────────────────────────

const COMMON_RULES = [
  { label: "-- 常用规则 --", value: "" },
  { label: "a 链接文本",          value: "//a/text()" },
  { label: "li > a 链接文本",     value: "//li/a/text()" },
  { label: "ul li a 链接文本",    value: "//ul/li/a/text()" },
  { label: "dt/dd 链接",          value: "//dt/a/@href" },
  { label: "h3 > a 文本",         value: "//h3/a/text()" },
  { label: "div.list a 文本",     value: "//div[contains(@class,'list')]//a/text()" },
  { label: "div.chapter a 文本",  value: "//div[contains(@class,'chapter')]//a/text()" },
  { label: "div.catalog a 文本",  value: "//div[contains(@class,'catalog')]//a/text()" },
  { label: "table td a 链接",     value: "//table//td/a/@href" },
];

const ENCODING_OPTIONS = [
  { label: "自动检测", value: "auto" },
  { label: "UTF-8",   value: "utf-8" },
  { label: "GBK",     value: "gbk" },
  { label: "GB2312",  value: "gb2312" },
  { label: "Big5",    value: "big5" },
];

const PAGE_URL_MODES = [
  { label: "插入后缀页", value: "suffix" },
  { label: "插入链接部分", value: "insert" },
];

const AI_SYSTEM = `你是专门分析中文小说网站 HTML 结构的专家。
分析目录页HTML，为以下3个字段生成XPath，严格输出JSON，不含其他内容：
{
  "list_novel_name":   {"xpath":"...","explanation":"..."},
  "list_release_date": {"xpath":"...","explanation":"..."},
  "list_release_url":  {"xpath":"...","explanation":"..."}
}
规则：优先用 id/class 属性，文本加 /text()，链接加 /@href，用 // 全局路径。无把握的字段 xpath 留空字符串。`;

// ─── Component ─────────────────────────────────────────────────────────────────

export function WizardStep2ListRules({ data, onChange }: Props) {
  const navigate = useNavigate();
  const aiEnabled = useAiStore((s) => s.config.enabled);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showSource, setShowSource] = useState(false);
  const [encoding, setEncoding] = useState("auto");

  // Book name test result
  const [bookNameTestResult, setBookNameTestResult] = useState<{ count: number; sample: string } | null>(null);

  const patch = (
    key: keyof Pick<WizardData, "list_novel_name" | "list_release_date" | "list_release_url">,
    rule: FieldRule
  ) => onChange({ ...data, [key]: rule });

  // ── Ensure HTML is loaded ────────────────────────────────────────────────────

  const ensureHtml = async (): Promise<string> => {
    if (data.catalog_html) return data.catalog_html;
    const url = data.catalog_url.trim();
    if (!url || url === "https://") throw new Error("请先在第三步填写并获取目录页网址");
    const html = await apiFetchSource(url);
    onChange({ ...data, catalog_html: html });
    return html;
  };

  // ── Common rule quick-select ─────────────────────────────────────────────────

  const applyCommonRule = (xpath: string) => {
    if (!xpath) return;
    onChange({
      ...data,
      list_release_url: { ...data.list_release_url, mode: "xpath", xpath },
    });
  };

  // ── Auto match ──────────────────────────────────────────────────────────────

  const [autoMatchLoading, setAutoMatchLoading] = useState(false);
  const runAutoMatch = async () => {
    setAutoMatchLoading(true);
    setErrorMsg("");
    try {
      const html = await ensureHtml();
      // Simple heuristic: find the <a> with most siblings that looks like chapter links
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Try common chapter list containers
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
          const snap = document.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (snap.snapshotLength > bestCount) {
            bestCount = snap.snapshotLength;
            bestXpath = xpath;
          }
        } catch { /* skip */ }
      }

      if (bestXpath) {
        onChange({
          ...data,
          catalog_html: html,
          list_release_url: { ...data.list_release_url, mode: "xpath", xpath: bestXpath },
        });
      } else {
        setErrorMsg("自动匹配未找到合适规则，请手动设置");
      }
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setAutoMatchLoading(false);
    }
  };

  // ── View source ─────────────────────────────────────────────────────────────

  const handleViewSource = async () => {
    setErrorMsg("");
    try {
      await ensureHtml();
      setShowSource((v) => !v);
    } catch (e) {
      setErrorMsg(String(e));
    }
  };

  // ── Book name test ───────────────────────────────────────────────────────────

  const testBookName = () => {
    if (!data.catalog_html) { setErrorMsg("请先获取页面源码"); return; }
    const xpath = buildBookNameXPath(data);
    if (!xpath) { setBookNameTestResult(null); return; }
    const v = validateXPath(data.catalog_html, xpath);
    setBookNameTestResult({ count: v.count, sample: v.samples[0] ?? "" });
  };

  // ── AI batch ────────────────────────────────────────────────────────────────

  const runBatchAi = async () => {
    if (!aiEnabled) return;
    setAiLoading("batch");
    setErrorMsg("");
    try {
      const html = await ensureHtml();
      const aiConfig = useAiStore.getState().activeConfig();
      const processed = preprocessHtml(html);
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n分析以下目录页 HTML，为3个字段生成 XPath：\n${processed}`,
        AI_SYSTEM,
        aiConfig
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;
      onChange({
        ...data,
        catalog_html: html,
        list_novel_name:   applyAiResult(data.list_novel_name,   parsed?.list_novel_name),
        list_release_date: applyAiResult(data.list_release_date, parsed?.list_release_date),
        list_release_url:  applyAiResult(data.list_release_url,  parsed?.list_release_url),
      });
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setAiLoading(null);
    }
  };

  const runFieldAi = async (
    fieldKey: "list_novel_name" | "list_release_date" | "list_release_url",
    fieldLabel: string
  ) => {
    if (!aiEnabled) return;
    setAiLoading(fieldKey);
    setErrorMsg("");
    try {
      const html = await ensureHtml();
      const aiConfig = useAiStore.getState().activeConfig();
      const processed = preprocessHtml(html);
      const system = `你是专门分析中文小说网站HTML结构的专家。
为字段"${fieldLabel}"生成最合适的XPath，严格输出JSON：{"xpath":"...","explanation":"..."}
文本加/text()，链接加/@href。`;
      const reply = await aiComplete(
        `网站：${data.catalog_url}\n\n分析以下HTML，为"${fieldLabel}"字段生成XPath：\n${processed}`,
        system,
        aiConfig
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;
      const xpath: string = parsed?.xpath ?? "";
      onChange({
        ...data,
        catalog_html: html,
        [fieldKey]: { ...data[fieldKey], mode: "ai", xpath } as FieldRule,
      });
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setAiLoading(null);
    }
  };

  // Derived XPath preview for book name
  const bookNameXPathPreview = useMemo(() => buildBookNameXPath(data), [data]);

  return (
    <div className="flex flex-col gap-4">

      {/* ── Section: 常用规则（快速选用）──────────────────────────────────── */}
      <Section title="常用规则（快速选用）" color="var(--color-text-muted)">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Auto match */}
          <Button
            size="sm"
            variant="secondary"
            onClick={runAutoMatch}
            disabled={autoMatchLoading}
          >
            {autoMatchLoading
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RefreshCw className="w-3 h-3" />
            }
            自动匹配
          </Button>

          {/* Common rules dropdown */}
          <select
            className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none"
            style={{
              background: "var(--color-surface-1)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
              flex: "1 1 160px",
              minWidth: 0,
            }}
            value=""
            onChange={(e) => applyCommonRule(e.target.value)}
          >
            {COMMON_RULES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          {/* Encoding */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>编码</span>
            <select
              className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none"
              style={{
                background: "var(--color-surface-1)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
                minWidth: 90,
              }}
              value={encoding}
              onChange={(e) => setEncoding(e.target.value)}
            >
              {ENCODING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* View source */}
          <button
            onClick={handleViewSource}
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
            原代码
          </button>
        </div>

        {/* Source preview */}
        {showSource && data.catalog_html && (
          <div
            className="rounded-lg border overflow-auto font-mono text-xs leading-relaxed p-2 mt-2"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              maxHeight: 180,
              color: "var(--color-text-muted)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {data.catalog_html.slice(0, 8000)}
            {data.catalog_html.length > 8000 && "\n\n… 已截断（仅显示前 8000 字符）"}
          </div>
        )}

        {/* AI batch */}
        <div className="flex items-center gap-2 mt-1">
          {aiEnabled ? (
            <Button size="sm" onClick={runBatchAi} disabled={aiLoading !== null}>
              {aiLoading === "batch"
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Sparkles className="w-3 h-3" />
              }
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
          {aiEnabled && (
            <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
              自动生成所有字段规则
            </span>
          )}
        </div>
      </Section>

      {/* Error */}
      {errorMsg && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Section: 规则设定（必填）─────────────────────────────────────── */}
      <Section title="规则设定（必填）" color="var(--color-danger)">
        <FieldRuleEditor
          label="目录页书名 *"
          rule={data.list_novel_name}
          onChange={(r) => patch("list_novel_name", r)}
          aiEnabled={aiEnabled}
          onAiRequest={() => runFieldAi("list_novel_name", "目录页书名")}
          aiLoading={aiLoading === "list_novel_name"}
        />
        <FieldRuleEditor
          label="更新日期"
          rule={data.list_release_date}
          onChange={(r) => patch("list_release_date", r)}
          aiEnabled={aiEnabled}
          onAiRequest={() => runFieldAi("list_release_date", "更新日期")}
          aiLoading={aiLoading === "list_release_date"}
        />
        <FieldRuleEditor
          label="章节链接 *"
          rule={data.list_release_url}
          onChange={(r) => patch("list_release_url", r)}
          aiEnabled={aiEnabled}
          onAiRequest={() => runFieldAi("list_release_url", "章节链接")}
          aiLoading={aiLoading === "list_release_url"}
        />
      </Section>

      {/* ── Section: 分页设置 ────────────────────────────────────────────── */}
      <Section title="分页设置" color="var(--color-text-muted)">
        {/* Pagination toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={data.has_pagination}
            onChange={(e) => onChange({ ...data, has_pagination: e.target.checked })}
            className="w-3.5 h-3.5 rounded"
          />
          <span className="text-xs" style={{ color: "var(--color-text)" }}>存在分页</span>
        </label>

        {data.has_pagination && (
          <div className="flex flex-wrap gap-3 mt-2 items-end">
            {/* Page URL mode */}
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>链接变化方式</label>
              <select
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none"
                style={{
                  background: "var(--color-surface-1)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
                value={data.page_url_mode}
                onChange={(e) => onChange({ ...data, page_url_mode: e.target.value as "suffix" | "insert" })}
              >
                {PAGE_URL_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Page total */}
            <div className="flex flex-col gap-1" style={{ width: 80 }}>
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>分页总数</label>
              <input
                type="number"
                min={1}
                max={999}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none w-full"
                style={{
                  background: "var(--color-surface-1)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
                value={data.page_total}
                onChange={(e) => onChange({ ...data, page_total: Math.max(1, Number(e.target.value)) })}
              />
            </div>

            {/* Insert part */}
            <div className="flex flex-col gap-1 flex-1" style={{ minWidth: 100 }}>
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>插入链接部分</label>
              <Input
                placeholder="如：_2  ?page=2"
                value={data.page_insert_part}
                onChange={(e) => onChange({ ...data, page_insert_part: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Hint */}
        <p className="text-xs mt-1" style={{ color: "var(--color-text-subtle)" }}>
          {data.has_pagination
            ? `共 ${data.page_total} 页，每页在链接中插入「${data.page_insert_part}」`
            : "若目录为单页，无需勾选"
          }
        </p>
      </Section>

      {/* ── Section: 书籍名称 ────────────────────────────────────────────── */}
      <Section title="书籍名称（可选）" color="var(--color-text-muted)">
        <div className="flex flex-col gap-2">
          {/* Use XPath toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={data.book_name_use_xpath}
              onChange={(e) => onChange({ ...data, book_name_use_xpath: e.target.checked })}
              className="w-3.5 h-3.5 rounded"
            />
            <span className="text-xs" style={{ color: "var(--color-text)" }}>使用 XPath</span>
            {bookNameXPathPreview && (
              <code
                className="text-xs font-mono ml-2 px-2 py-0.5 rounded"
                style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}
              >
                {bookNameXPathPreview}
              </code>
            )}
          </label>

          {/* Tag / attr / value row */}
          <div className="flex gap-2 flex-wrap items-end">
            <div className="flex flex-col gap-1" style={{ flex: "1 1 80px", minWidth: 70 }}>
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>标签名称</label>
              <select
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none"
                style={{
                  background: "var(--color-surface-1)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
                value={data.book_name_tag}
                onChange={(e) => onChange({ ...data, book_name_tag: e.target.value })}
              >
                {["h1","h2","h3","h4","div","span","p","title"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1" style={{ flex: "1 1 80px", minWidth: 70 }}>
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>属性名称</label>
              <select
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none"
                style={{
                  background: "var(--color-surface-1)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
                value={data.book_name_attr}
                onChange={(e) => onChange({ ...data, book_name_attr: e.target.value })}
              >
                <option value="">-- 无 --</option>
                {["class","id","name","itemprop"].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1" style={{ minWidth: 80 }}>
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>值</label>
              <Input
                placeholder="如：bookname  book-title"
                value={data.book_name_val}
                onChange={(e) => onChange({ ...data, book_name_val: e.target.value })}
              />
            </div>
            {/* Test button */}
            <button
              onClick={testBookName}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors shrink-0 self-end"
              style={{
                background: "var(--color-surface-1)",
                borderColor: "var(--color-border)",
                color: "var(--color-accent)",
                fontWeight: 500,
                marginBottom: 0,
              }}
            >
              <TestTube2 className="w-3 h-3" />
              测试
            </button>
          </div>

          {/* Test result */}
          {bookNameTestResult !== null && (
            <div
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
              style={{
                background: bookNameTestResult.count > 0 ? "var(--color-success-bg)" : "var(--color-warning-bg)",
                color: bookNameTestResult.count > 0 ? "var(--color-success)" : "var(--color-warning)",
              }}
            >
              命中 {bookNameTestResult.count} 个
              {bookNameTestResult.sample && (
                <span style={{ color: "var(--color-text-muted)" }}>— {bookNameTestResult.sample}</span>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* ── Instruction ─────────────────────────────────────────────────── */}
      <div
        className="rounded-xl px-4 py-3 text-xs leading-relaxed"
        style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
      >
        <p className="font-medium mb-1" style={{ color: "var(--color-text)" }}>第四步：设定目录页规则</p>
        <p style={{ color: "var(--color-danger)" }}>
          红色框为必填项，需根据 HTML 原代码进行分析，可用底部「XPath 工具」按钮快速查看。设定好规则后用「目录测试」步骤检测是否正确。书籍名称规则（非必填）可做为预设网站时自动提取，嫌麻烦也可以在生成任务时再手动填写。
        </p>
        <p className="mt-1.5" style={{ color: "var(--color-text-subtle)" }}>
          「方式」下拉菜单中可以切换为 XPath 规则模式，XPath 规则与标签规则可同时混用。
        </p>
      </div>
    </div>
  );
}

// ─── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title, color = "var(--color-text-muted)", children,
}: {
  title: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2.5 rounded-xl p-3 border"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <p
        className="text-xs font-semibold"
        style={{ color }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

// ─── Book name XPath builder ───────────────────────────────────────────────────

function buildBookNameXPath(data: WizardData): string {
  if (data.book_name_use_xpath) {
    const tag = data.book_name_tag || "*";
    const attr = data.book_name_attr;
    const val = data.book_name_val.trim();
    if (attr && val) return `//${tag}[@${attr}="${val}"]/text()`;
    if (attr)        return `//${tag}[@${attr}]/text()`;
    return `//${tag}/text()`;
  }
  return "";
}

// ─── AI helper ────────────────────────────────────────────────────────────────

function applyAiResult(existing: FieldRule, result?: { xpath?: string }): FieldRule {
  const xpath = result?.xpath ?? "";
  if (!xpath) return existing;
  return { ...existing, mode: "ai", xpath };
}

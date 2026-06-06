/**
 * Step 4 — 目录规则
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Code2, Loader2, RefreshCw, Sparkles, TestTube2 } from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { validateXPath } from "@/lib/ai";
import { apiFetchSource } from "@/lib/api/files";

import { buildBookNameXPath } from "./components/BookNameConfig";
import { PaginationSection } from "./components/PaginationSection";
import { WizardSection } from "./components/WizardSection";
import { FieldRuleEditor } from "./FieldRuleEditor";
import { useWizardListRulesAi } from "./hooks/useWizardListRulesAi";
import type { FieldRule, WizardData } from "./ruleUtils";

interface Props {
  data: WizardData;
  onChange: (d: WizardData) => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const COMMON_RULES = [
  { label: "-- 常用规则 --", value: "" },
  { label: "a 链接文本", value: "//a/text()" },
  { label: "li > a 链接文本", value: "//li/a/text()" },
  { label: "ul li a 链接文本", value: "//ul/li/a/text()" },
  { label: "dt/dd 链接", value: "//dt/a/@href" },
  { label: "h3 > a 文本", value: "//h3/a/text()" },
  { label: "div.list a 文本", value: "//div[contains(@class,'list')]//a/text()" },
  { label: "div.chapter a 文本", value: "//div[contains(@class,'chapter')]//a/text()" },
  { label: "div.catalog a 文本", value: "//div[contains(@class,'catalog')]//a/text()" },
  { label: "table td a 链接", value: "//table//td/a/@href" },
];

const ENCODING_OPTIONS = [
  { label: "自动检测", value: "auto" },
  { label: "UTF-8", value: "utf-8" },
  { label: "GBK", value: "gbk" },
  { label: "GB2312", value: "gb2312" },
  { label: "Big5", value: "big5" },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export function WizardStep2ListRules({ data, onChange }: Props) {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState("");
  const [showSource, setShowSource] = useState(false);
  const [encoding, setEncoding] = useState("auto");
  const [bookNameTestResult, setBookNameTestResult] = useState<{
    count: number;
    sample: string;
  } | null>(null);
  const [autoMatchLoading, setAutoMatchLoading] = useState(false);

  const patch = (
    key: keyof Pick<WizardData, "list_novel_name" | "list_release_date" | "list_release_url">,
    rule: FieldRule,
  ) => onChange({ ...data, [key]: rule });

  // ── Ensure HTML ─────────────────────────────────────────────────────────────

  const ensureHtml = async (): Promise<string> => {
    if (data.catalog_html) return data.catalog_html;
    const url = data.catalog_url.trim();
    if (!url || url === "https://") throw new Error("请先在第三步填写并获取目录页网址");
    const html = await apiFetchSource(url);
    onChange({ ...data, catalog_html: html });
    return html;
  };

  // ── AI hook ────────────────────────────────────────────────────────────────

  const { aiEnabled, aiLoading, runBatchAi, runFieldAi } = useWizardListRulesAi(
    data,
    onChange,
    ensureHtml,
    setErrorMsg,
  );

  // ── Common rule quick-select ─────────────────────────────────────────────────

  const applyCommonRule = (xpath: string) => {
    if (!xpath) return;
    onChange({
      ...data,
      list_release_url: { ...data.list_release_url, mode: "xpath", xpath },
    });
  };

  // ── Auto match ──────────────────────────────────────────────────────────────

  const runAutoMatch = async () => {
    setAutoMatchLoading(true);
    setErrorMsg("");
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
          const snap = document.evaluate(
            xpath,
            doc,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null,
          );
          if (snap.snapshotLength > bestCount) {
            bestCount = snap.snapshotLength;
            bestXpath = xpath;
          }
        } catch {
          /* skip */
        }
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

  const bookNameXPathPreview = useMemo(() => buildBookNameXPath(data), [data]);

  const testBookName = () => {
    if (!data.catalog_html) {
      setErrorMsg("请先获取页面源码");
      return;
    }
    const xpath = bookNameXPathPreview;
    if (!xpath) {
      setBookNameTestResult(null);
      return;
    }
    const v = validateXPath(data.catalog_html, xpath);
    setBookNameTestResult({ count: v.count, sample: v.samples[0] ?? "" });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Section: 常用规则（快速选用）──────────────────────────────────── */}
      <WizardSection title="常用规则（快速选用）" color="var(--color-text-muted)">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={runAutoMatch} disabled={autoMatchLoading}>
            {autoMatchLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            自动匹配
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
            onChange={(e) => applyCommonRule(e.target.value)}
          >
            {COMMON_RULES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              编码
            </span>
            <select
              className="rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
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
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleViewSource}
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
            原代码
          </button>
        </div>

        {showSource && data.catalog_html && (
          <div
            className="mt-2 overflow-auto rounded-lg border p-2 font-mono text-xs leading-relaxed"
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

        <div className="mt-1 flex items-center gap-2">
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
          {aiEnabled && (
            <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
              自动生成所有字段规则
            </span>
          )}
        </div>
      </WizardSection>

      {/* Error */}
      {errorMsg && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Section: 规则设定（必填）─────────────────────────────────────── */}
      <WizardSection title="规则设定（必填）" color="var(--color-danger)">
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
      </WizardSection>

      {/* ── Section: 分页设置 ────────────────────────────────────────────── */}
      <PaginationSection data={data} onChange={onChange} />

      {/* ── Section: 书籍名称 ────────────────────────────────────────────── */}
      <WizardSection title="书籍名称（可选）" color="var(--color-text-muted)">
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={data.book_name_use_xpath}
              onChange={(e) => onChange({ ...data, book_name_use_xpath: e.target.checked })}
              className="h-3.5 w-3.5 rounded"
            />
            <span className="text-xs" style={{ color: "var(--color-text)" }}>
              使用 XPath
            </span>
            {bookNameXPathPreview && (
              <code
                className="ml-2 rounded px-2 py-0.5 font-mono text-xs"
                style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}
              >
                {bookNameXPathPreview}
              </code>
            )}
          </label>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1" style={{ flex: "1 1 80px", minWidth: 70 }}>
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                标签名称
              </label>
              <select
                className="rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
                style={{
                  background: "var(--color-surface-1)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
                value={data.book_name_tag}
                onChange={(e) => onChange({ ...data, book_name_tag: e.target.value })}
              >
                {["h1", "h2", "h3", "h4", "div", "span", "p", "title"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1" style={{ flex: "1 1 80px", minWidth: 70 }}>
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                属性名称
              </label>
              <select
                className="rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
                style={{
                  background: "var(--color-surface-1)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
                value={data.book_name_attr}
                onChange={(e) => onChange({ ...data, book_name_attr: e.target.value })}
              >
                <option value="">-- 无 --</option>
                {["class", "id", "name", "itemprop"].map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1" style={{ minWidth: 80 }}>
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                值
              </label>
              <Input
                placeholder="如：bookname  book-title"
                value={data.book_name_val}
                onChange={(e) => onChange({ ...data, book_name_val: e.target.value })}
              />
            </div>
            <button
              onClick={testBookName}
              className="flex shrink-0 items-center gap-1 self-end rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
              style={{
                background: "var(--color-surface-1)",
                borderColor: "var(--color-border)",
                color: "var(--color-accent)",
                fontWeight: 500,
              }}
            >
              <TestTube2 className="h-3 w-3" />
              测试
            </button>
          </div>

          {bookNameTestResult !== null && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
              style={{
                background:
                  bookNameTestResult.count > 0
                    ? "var(--color-success-bg)"
                    : "var(--color-warning-bg)",
                color:
                  bookNameTestResult.count > 0 ? "var(--color-success)" : "var(--color-warning)",
              }}
            >
              命中 {bookNameTestResult.count} 个
              {bookNameTestResult.sample && (
                <span style={{ color: "var(--color-text-muted)" }}>
                  — {bookNameTestResult.sample}
                </span>
              )}
            </div>
          )}
        </div>
      </WizardSection>

      {/* ── Instruction ─────────────────────────────────────────────────── */}
      <div
        className="rounded-xl px-4 py-3 text-xs leading-relaxed"
        style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
      >
        <p className="mb-1 font-medium" style={{ color: "var(--color-text)" }}>
          第四步：设定目录页规则
        </p>
        <p style={{ color: "var(--color-danger)" }}>
          红色框为必填项，需根据 HTML 原代码进行分析，可用底部「XPath
          工具」按钮快速查看。设定好规则后用「目录测试」步骤检测是否正确。书籍名称规则（非必填）可做为预设网站时自动提取，嫌麻烦也可以在生成任务时再手动填写。
        </p>
        <p className="mt-1.5" style={{ color: "var(--color-text-subtle)" }}>
          「方式」下拉菜单中可以切换为 XPath 规则模式，XPath 规则与标签规则可同时混用。
        </p>
      </div>
    </div>
  );
}

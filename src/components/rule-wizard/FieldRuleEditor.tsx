/**
 * FieldRuleEditor — 单个字段的规则编辑器
 * 支持 8 种模式：tag_name / attr_name / attr_value / tag_attr_value /
 *               link_keyword / text_keyword / xpath / ai
 * 实时预览转换后的 XPath 表达式，可点击预览查看实际命中结果
 */
import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

import {
  buildXPathFromRule,
  getVisibleInputs,
  RULE_MODES,
  type ExtractAs,
  type FieldRule,
  type RuleMode,
} from "./ruleUtils";

interface FieldRuleEditorProps {
  label: string;
  rule: FieldRule;
  onChange: (r: FieldRule) => void;
  /** Whether AI is enabled (shows AI button) */
  aiEnabled?: boolean;
  /** Called when user clicks AI button — parent handles the async */
  onAiRequest?: () => void;
  aiLoading?: boolean;
  /** Cached HTML for live preview of XPath hits */
  html?: string;
}

// ─── XPath eval helper ────────────────────────────────────────────────────────

function evalXPathSamples(html: string, xpath: string, max = 8): string[] {
  if (!xpath || !html) return [];
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const snap = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const out: string[] = [];
    for (let i = 0; i < Math.min(snap.snapshotLength, max); i++) {
      const node = snap.snapshotItem(i);
      const v = (node?.textContent ?? (node as Attr | null)?.value ?? "").trim();
      if (v) out.push(v);
    }
    return out;
  } catch {
    return [];
  }
}

function countXPathHits(html: string, xpath: string): number {
  if (!xpath || !html) return 0;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const snap = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    return snap.snapshotLength;
  } catch {
    return 0;
  }
}

const EXTRACT_OPTIONS: { value: ExtractAs; label: string }[] = [
  { value: "text", label: "文本内容" },
  { value: "href", label: "@href 链接" },
  { value: "src", label: "@src 图片" },
  { value: "custom", label: "自定义属性" },
];

export function FieldRuleEditor({
  label,
  rule,
  onChange,
  aiEnabled,
  onAiRequest,
  aiLoading,
  html,
}: FieldRuleEditorProps) {
  const vis = getVisibleInputs(rule.mode);
  const preview = useMemo(() => buildXPathFromRule(rule), [rule]);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Compute hits lazily when preview is opened
  const previewSamples = useMemo(() => {
    if (!previewOpen || !html || !preview) return null;
    const samples = evalXPathSamples(html, preview);
    const total = countXPathHits(html, preview);
    return { samples, total };
  }, [previewOpen, html, preview]);

  const patch = (p: Partial<FieldRule>) => onChange({ ...rule, ...p });

  return (
    <div
      className="flex flex-col gap-2.5 rounded-xl border p-3"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      {/* Label + mode selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs font-semibold" style={{ color: "var(--color-text)" }}>
          {label}
        </span>
        <select
          className="ml-auto rounded-lg border px-2 py-1 text-xs focus:outline-none"
          style={{
            background: "var(--color-surface-1)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
            minWidth: 130,
          }}
          value={rule.mode}
          onChange={(e) => patch({ mode: e.target.value as RuleMode })}
        >
          {RULE_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {aiEnabled && onAiRequest && (
          <Button
            size="sm"
            onClick={onAiRequest}
            disabled={aiLoading}
            style={{ fontSize: 11, padding: "3px 8px" }}
          >
            {aiLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {aiLoading ? "分析中..." : "AI 生成"}
          </Button>
        )}
      </div>

      {/* Dynamic input fields */}
      <div className="flex flex-col gap-2">
        {/* tag_name */}
        {vis.tag_name && (
          <Input
            label="标签名"
            placeholder="如：a  li  h2  div"
            value={rule.tag_name}
            onChange={(e) => patch({ tag_name: e.target.value })}
          />
        )}

        {/* attr_name */}
        {vis.attr_name && (
          <Input
            label="属性名"
            placeholder="如：class  id  href  data-id"
            value={rule.attr_name}
            onChange={(e) => patch({ attr_name: e.target.value })}
          />
        )}

        {/* attr_val */}
        {vis.attr_val && (
          <Input
            label="属性值"
            placeholder="如：book-title  list-item（留空=任意值）"
            value={rule.attr_val}
            onChange={(e) => patch({ attr_val: e.target.value })}
          />
        )}

        {/* keyword */}
        {vis.keyword && (
          <Input
            label={rule.mode === "link_keyword" ? "链接关键字" : "文本关键字"}
            placeholder={
              rule.mode === "link_keyword" ? "如：/novel/  /book/" : "如：最新更新  连载中"
            }
            value={rule.keyword}
            onChange={(e) => patch({ keyword: e.target.value })}
          />
        )}

        {/* extract */}
        {vis.extract && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              提取方式
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EXTRACT_OPTIONS.map((opt) => {
                const active = rule.extract === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => patch({ extract: opt.value })}
                    className="rounded-lg border px-2.5 py-1 text-xs transition-colors"
                    style={{
                      background: active ? "var(--color-accent-muted)" : "var(--color-surface-1)",
                      borderColor: active
                        ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
                        : "var(--color-border)",
                      color: active ? "var(--color-accent)" : "var(--color-text-muted)",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {rule.extract === "custom" && (
              <Input
                placeholder="自定义属性名，如：data-url"
                value={rule.custom_attr}
                onChange={(e) => patch({ custom_attr: e.target.value })}
              />
            )}
          </div>
        )}

        {/* direct xpath input */}
        {vis.xpath_direct && (
          <Input
            label="XPath 表达式"
            placeholder="//div[@class='content']/text()"
            value={rule.xpath}
            onChange={(e) => patch({ xpath: e.target.value })}
          />
        )}

        {/* ai mode — show current xpath result if any */}
        {rule.mode === "ai" && rule.xpath && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              AI 生成结果（可编辑）
            </label>
            <Input
              value={rule.xpath}
              onChange={(e) => patch({ xpath: e.target.value })}
              placeholder="点击上方 AI 生成按钮..."
            />
          </div>
        )}
      </div>

      {/* Live XPath preview — clickable to show actual hits */}
      {preview && rule.mode !== "xpath" && (
        <div className="flex flex-col gap-0">
          <button
            type="button"
            onClick={() => html && setPreviewOpen((v) => !v)}
            className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors"
            style={{
              background: previewOpen
                ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface-2))"
                : "var(--color-surface-2)",
              cursor: html ? "pointer" : "default",
              borderRadius: previewOpen ? "8px 8px 0 0" : 8,
            }}
            title={
              html
                ? previewOpen
                  ? "收起预览结果"
                  : "点击查看实际命中结果"
                : "获取页面后可查看命中结果"
            }
          >
            <span className="mt-0.5 shrink-0 text-xs" style={{ color: "var(--color-text-subtle)" }}>
              预览
            </span>
            <code
              className="flex-1 font-mono text-xs break-all"
              style={{ color: "var(--color-accent)" }}
            >
              {preview}
            </code>
            {html &&
              (previewOpen ? (
                <ChevronUp
                  className="mt-0.5 h-3 w-3 shrink-0"
                  style={{ color: "var(--color-text-subtle)" }}
                />
              ) : (
                <ChevronDown
                  className="mt-0.5 h-3 w-3 shrink-0"
                  style={{ color: "var(--color-text-subtle)" }}
                />
              ))}
          </button>

          {/* Expanded hit results */}
          {previewOpen && html && (
            <div
              className="flex flex-col gap-1 rounded-b-lg border-t px-3 py-2"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
              }}
            >
              {previewSamples === null ? null : previewSamples.total === 0 ? (
                <div
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: "var(--color-warning)" }}
                >
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  未命中任何结果
                </div>
              ) : (
                <>
                  <div
                    className="flex items-center gap-1.5 text-xs"
                    style={{ color: "var(--color-success)" }}
                  >
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    命中 {previewSamples.total} 个
                  </div>
                  {previewSamples.samples.map((s, i) => (
                    <span
                      key={i}
                      className="truncate pl-4 text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                      title={s}
                    >
                      {i + 1}. {s}
                    </span>
                  ))}
                  {previewSamples.total > previewSamples.samples.length && (
                    <span className="pl-4 text-xs" style={{ color: "var(--color-text-subtle)" }}>
                      …还有 {previewSamples.total - previewSamples.samples.length} 条
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

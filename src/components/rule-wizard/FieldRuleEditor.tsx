/**
 * FieldRuleEditor — 单个字段的规则编辑器
 * 支持 8 种模式：tag_name / attr_name / attr_value / tag_attr_value /
 *               link_keyword / text_keyword / xpath / ai
 * 实时预览转换后的 XPath 表达式
 */
import { useMemo } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import {
  type FieldRule, type RuleMode, type ExtractAs,
  RULE_MODES, buildXPathFromRule, getVisibleInputs,
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
}

const EXTRACT_OPTIONS: { value: ExtractAs; label: string }[] = [
  { value: "text", label: "文本内容" },
  { value: "href", label: "@href 链接" },
  { value: "src",  label: "@src 图片" },
  { value: "custom", label: "自定义属性" },
];

export function FieldRuleEditor({
  label, rule, onChange, aiEnabled, onAiRequest, aiLoading,
}: FieldRuleEditorProps) {
  const vis = getVisibleInputs(rule.mode);
  const preview = useMemo(() => buildXPathFromRule(rule), [rule]);

  const patch = (p: Partial<FieldRule>) => onChange({ ...rule, ...p });

  return (
    <div
      className="flex flex-col gap-2.5 rounded-xl p-3 border"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      {/* Label + mode selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold shrink-0" style={{ color: "var(--color-text)" }}>
          {label}
        </span>
        <select
          className="text-xs border rounded-lg px-2 py-1 focus:outline-none ml-auto"
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
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {aiEnabled && rule.mode === "ai" && (
          <Button
            size="sm"
            onClick={onAiRequest}
            disabled={aiLoading}
            style={{ fontSize: 11, padding: "3px 8px" }}
          >
            {aiLoading
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Sparkles className="w-3 h-3" />
            }
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
            placeholder={rule.mode === "link_keyword" ? "如：/novel/  /book/" : "如：最新更新  连载中"}
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
            <div className="flex gap-1.5 flex-wrap">
              {EXTRACT_OPTIONS.map((opt) => {
                const active = rule.extract === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => patch({ extract: opt.value })}
                    className="text-xs px-2.5 py-1 rounded-lg border transition-colors"
                    style={{
                      background: active ? "var(--color-accent-muted)" : "var(--color-surface-1)",
                      borderColor: active ? "color-mix(in srgb, var(--color-accent) 40%, transparent)" : "var(--color-border)",
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

      {/* Live XPath preview */}
      {preview && rule.mode !== "xpath" && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-lg"
          style={{ background: "var(--color-surface-2)" }}
        >
          <span className="text-xs shrink-0 mt-0.5" style={{ color: "var(--color-text-subtle)" }}>
            预览
          </span>
          <code
            className="text-xs font-mono break-all flex-1"
            style={{ color: "var(--color-accent)" }}
          >
            {preview}
          </code>
        </div>
      )}
    </div>
  );
}

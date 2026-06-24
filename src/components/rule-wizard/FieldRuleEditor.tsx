import { useId } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

import {
  buildXPathFromRule,
  RULE_MODES,
  type ExtractAs,
  type FieldRule,
  type RuleMode,
} from "./ruleUtils";
import { WizardSection } from "./components/WizardSection";

interface FieldRuleEditorProps {
  label: string;
  rule: FieldRule;
  onChange: (rule: FieldRule) => void;
  aiEnabled?: boolean;
  onAiRequest?: () => void;
  aiLoading?: boolean;
  html?: string;
}

const EXTRACT_OPTIONS: Array<{ label: string; value: ExtractAs }> = [
  { label: "文本", value: "text" },
  { label: "链接 href", value: "href" },
  { label: "图片 src", value: "src" },
  { label: "自定义属性", value: "custom" },
];

function patchRule(rule: FieldRule, patch: Partial<FieldRule>): FieldRule {
  return { ...rule, ...patch };
}

export function FieldRuleEditor({
  label,
  rule,
  onChange,
  aiEnabled = false,
  onAiRequest,
  aiLoading = false,
  html,
}: FieldRuleEditorProps) {
  const fieldId = useId();
  const finalXpath = buildXPathFromRule(rule).trim();
  const hasHtml = Boolean(html?.trim());
  const modeId = `${fieldId}-mode`;
  const extractLabelId = `${fieldId}-extract-label`;

  return (
    <WizardSection title={label} color="var(--color-text)">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1">
            <label
              htmlFor={modeId}
              className="mb-1 block text-xs font-medium"
              style={{ color: "var(--color-text-muted)" }}
            >
              规则类型
            </label>
            <select
              id={modeId}
              name="field-rule-mode"
              value={rule.mode}
              onChange={(event) => onChange(patchRule(rule, { mode: event.target.value as RuleMode }))}
              className="w-full rounded-[10px] border px-3 py-2 text-sm focus:outline-none"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              {RULE_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>

          {onAiRequest && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onAiRequest}
              disabled={!aiEnabled || aiLoading || !hasHtml}
              title={!hasHtml ? "请先获取页面 HTML 后再使用 AI 分析" : undefined}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiLoading ? "AI 识别中..." : "AI 识别"}
            </Button>
          )}
        </div>

        {(rule.mode === "tag_name" || rule.mode === "tag_attr_value") && (
          <Input
            label="标签名"
            placeholder="例如：a / div / h1"
            value={rule.tag_name}
            onChange={(event) => onChange(patchRule(rule, { tag_name: event.target.value }))}
          />
        )}

        {(rule.mode === "attr_name" || rule.mode === "attr_value" || rule.mode === "tag_attr_value") && (
          <Input
            label="属性名"
            placeholder="例如：class / id / data-title"
            value={rule.attr_name}
            onChange={(event) => onChange(patchRule(rule, { attr_name: event.target.value }))}
          />
        )}

        {(rule.mode === "attr_value" || rule.mode === "tag_attr_value") && (
          <Input
            label="属性值"
            placeholder="例如：bookname / chapter-list"
            value={rule.attr_val}
            onChange={(event) => onChange(patchRule(rule, { attr_val: event.target.value }))}
          />
        )}

        {(rule.mode === "link_keyword" || rule.mode === "text_keyword") && (
          <Input
            label="关键词"
            placeholder={rule.mode === "link_keyword" ? "例如：chapter / html" : "例如：最新章节 / 正文"}
            value={rule.keyword}
            onChange={(event) => onChange(patchRule(rule, { keyword: event.target.value }))}
          />
        )}

        {["tag_name", "attr_name", "attr_value", "tag_attr_value", "text_keyword"].includes(rule.mode) && (
          <div className="flex flex-col gap-2">
            <span
              id={extractLabelId}
              className="text-xs font-medium"
              style={{ color: "var(--color-text-muted)" }}
            >
              提取内容
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby={extractLabelId}>
              {EXTRACT_OPTIONS.map((option) => {
                const active = rule.extract === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChange(patchRule(rule, { extract: option.value }))}
                    className="rounded-full border px-2.5 py-1 text-xs transition-colors"
                    style={{
                      background: active ? "var(--color-accent-muted)" : "var(--color-surface-1)",
                      borderColor: active
                        ? "color-mix(in srgb, var(--color-accent) 45%, transparent)"
                        : "var(--color-border)",
                      color: active ? "var(--color-accent)" : "var(--color-text-muted)",
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {rule.extract === "custom" &&
          ["tag_name", "attr_name", "attr_value", "tag_attr_value", "text_keyword"].includes(rule.mode) && (
            <Input
              label="自定义属性名"
              placeholder="例如：data-src / content"
              value={rule.custom_attr}
              onChange={(event) => onChange(patchRule(rule, { custom_attr: event.target.value }))}
            />
          )}

        {(rule.mode === "xpath" || rule.mode === "ai") && (
          <Input
            label="XPath"
            placeholder="//div[@class='content']/text()"
            value={rule.xpath}
            onChange={(event) => onChange(patchRule(rule, { xpath: event.target.value }))}
          />
        )}

        <div
          className="rounded-xl border px-3 py-2"
          style={{
            background: "var(--color-surface-1)",
            borderColor: finalXpath ? "var(--color-border)" : "var(--color-warning)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              最终 XPath
            </span>
            {rule.mode === "ai" && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px]"
                style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
              >
                AI 生成
              </span>
            )}
          </div>
          <code
            className="mt-2 block overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs"
            style={{ color: finalXpath ? "var(--color-text)" : "var(--color-text-subtle)" }}
          >
            {finalXpath || "当前规则还没有生成可用的 XPath"}
          </code>
        </div>
      </div>
    </WizardSection>
  );
}

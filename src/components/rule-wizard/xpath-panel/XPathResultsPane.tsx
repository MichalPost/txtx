import { ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/Button";

import { XPathQuickGuide } from "../components/XPathQuickGuide";
import { XPathResultRow } from "../components/XPathResultRow";
import type { FieldState } from "../hooks/useXPathFields";
import { validateGeneratedXPath } from "../xpathTool";
import type { TargetField, XPathTarget } from "../xpathTool";

interface XPathResultsPaneProps {
  activeField: TargetField;
  adoptedCount: number;
  anyGenerating: boolean;
  availableTargets: XPathTarget[];
  fields: Record<TargetField, FieldState>;
  html: string;
  page: "catalog" | "chapter" | "update_list";
  onActivate: (field: TargetField) => void;
  onApply: () => void;
  onChange: (field: TargetField, value: string) => void;
  onClose: () => void;
  onToggleAdopt: (field: TargetField) => void;
}

export function XPathResultsPane({
  activeField,
  adoptedCount,
  anyGenerating,
  availableTargets,
  fields,
  html,
  page,
  onActivate,
  onApply,
  onChange,
  onClose,
  onToggleAdopt,
}: XPathResultsPaneProps) {
  const validAdoptedCount = availableTargets.filter((target) => {
    const field = fields[target.field];
    if (!field.adopted || !field.generatedXPath) return false;
    const validation = validateGeneratedXPath(html, field.generatedXPath);
    return !validation.error && validation.count > 0;
  }).length;

  return (
    <div className="flex flex-1 flex-col gap-0 overflow-hidden">
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
              XPath 表达式结果
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-text-subtle)" }}>
              已勾选 {adoptedCount} 个字段；只有语法正确且命中数大于 0 的 XPath 才能应用。
            </p>
          </div>
          {anyGenerating && (
            <div
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: "var(--color-accent)" }}
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              生成中...
            </div>
          )}
        </div>

        {availableTargets.map((t) => {
          const f = fields[t.field];
          return (
            <XPathResultRow
              key={t.field}
              target={t}
              html={html}
              xpath={f.generatedXPath}
              adopted={f.adopted}
              isActive={activeField === t.field}
              generating={f.generating}
              onActivate={() => onActivate(t.field)}
              onToggleAdopt={() => onToggleAdopt(t.field)}
              onChange={(val) => onChange(t.field, val)}
            />
          );
        })}

        {availableTargets.every((t) => !fields[t.field].generatedXPath) && (
          <XPathQuickGuide page={page} />
        )}
      </div>

      <div
        className="flex shrink-0 items-center gap-2 border-t px-4 py-3"
        style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
        <Button size="sm" onClick={onApply} disabled={validAdoptedCount === 0}>
          <ChevronRight className="h-3.5 w-3.5" />
          应用已选（{validAdoptedCount} 个）
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          取消
        </Button>
      </div>
    </div>
  );
}

/**
 * PaginationSection — 分页设置区块，Step1UpdateList / Step2ListRules 共用
 */
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

import type { WizardData } from "../ruleUtils";
import { WizardSection } from "./WizardSection";

const PAGE_URL_MODES = [
  { label: "插入后缀页", value: "suffix" },
  { label: "插入链接部分", value: "insert" },
];

interface PaginationSectionProps {
  data: WizardData;
  onChange: (d: WizardData) => void;
  badge?: string;
  /** 若提供则显示 AI 分析分页按钮 */
  onAiAnalyze?: () => void;
  aiLoading?: boolean;
  aiEnabled?: boolean;
}

export function PaginationSection({
  data,
  onChange,
  badge,
  onAiAnalyze,
  aiLoading = false,
  aiEnabled = false,
}: PaginationSectionProps) {
  return (
    <WizardSection title="分页设置" color="var(--color-text-muted)" badge={badge}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 select-none">
          <input
            type="checkbox"
            checked={data.has_pagination}
            onChange={(e) => onChange({ ...data, has_pagination: e.target.checked })}
            className="h-3.5 w-3.5 rounded"
          />
          <span className="text-xs" style={{ color: "var(--color-text)" }}>
            存在分页
          </span>
        </label>

        {aiEnabled && onAiAnalyze && (
          <Button size="sm" variant="secondary" onClick={onAiAnalyze} disabled={aiLoading}>
            {aiLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {aiLoading ? "AI 分析中..." : "AI 分析分页"}
          </Button>
        )}
      </div>

      {data.has_pagination && (
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              链接变化方式
            </label>
            <select
              className="rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
              style={{
                background: "var(--color-surface-1)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              value={data.page_url_mode}
              onChange={(e) =>
                onChange({ ...data, page_url_mode: e.target.value as "suffix" | "insert" })
              }
            >
              {PAGE_URL_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1" style={{ width: 80 }}>
            <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              分页总数
            </label>
            <input
              type="number"
              min={1}
              max={999}
              className="w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
              style={{
                background: "var(--color-surface-1)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              value={data.page_total}
              onChange={(e) =>
                onChange({ ...data, page_total: Math.max(1, Number(e.target.value)) })
              }
            />
          </div>

          <div className="flex flex-1 flex-col gap-1" style={{ minWidth: 100 }}>
            <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              插入链接部分
            </label>
            <Input
              placeholder="如：_2  ?page=2"
              value={data.page_insert_part}
              onChange={(e) => onChange({ ...data, page_insert_part: e.target.value })}
            />
          </div>
        </div>
      )}

      <p className="mt-1 text-xs" style={{ color: "var(--color-text-subtle)" }}>
        {data.has_pagination
          ? `共 ${data.page_total} 页，每页在链接中插入「${data.page_insert_part}」`
          : "若列表为单页，无需勾选"}
      </p>
    </WizardSection>
  );
}

/**
 * 章节列表实时解析预览 — 从 WizardStepCatalog 提取
 */
import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

import type { ChapterListItem } from "../ruleUtils";

interface ChapterListPreviewProps {
  chapters: ChapterListItem[];
  selectedUrl: string;
  onSelect: (item: ChapterListItem) => void;
}

export function ChapterListPreview({ chapters, selectedUrl, onSelect }: ChapterListPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? chapters : chapters.slice(0, 6);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs font-semibold" style={{ color: "var(--color-text)" }}>
          实时解析预览
        </p>
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
        >
          <CheckCircle2 className="mr-1 inline h-2.5 w-2.5" />
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
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all"
              style={{
                background: selected
                  ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))"
                  : "var(--color-surface-1)",
                borderColor: selected ? "var(--color-accent)" : "var(--color-border)",
              }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  background: selected ? "var(--color-accent)" : "var(--color-surface-2)",
                  color: selected ? "#fff" : "var(--color-text-subtle)",
                }}
              >
                {i + 1}
              </span>
              <span
                className="flex-1 truncate font-medium"
                style={{ color: selected ? "var(--color-accent)" : "var(--color-text)" }}
              >
                {c.title}
              </span>
              {c.date && (
                <span className="shrink-0" style={{ color: "var(--color-text-subtle)" }}>
                  {c.date}
                </span>
              )}
              <span
                className="max-w-[30%] shrink-0 truncate font-mono"
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
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              收起
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              展开全部 {chapters.length} 章
            </>
          )}
        </button>
      )}
      <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
        ✓ 点击章节可选为测试章节，下一步将用其配置章节页规则
      </p>
    </div>
  );
}

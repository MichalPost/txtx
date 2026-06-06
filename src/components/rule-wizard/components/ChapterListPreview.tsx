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

export function ChapterListPreview({
  chapters, selectedUrl, onSelect,
}: ChapterListPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? chapters : chapters.slice(0, 6);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold flex-1" style={{ color: "var(--color-text)" }}>
          实时解析预览
        </p>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
        >
          <CheckCircle2 className="w-2.5 h-2.5 inline mr-1" />
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
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border text-left transition-all"
              style={{
                background: selected
                  ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))"
                  : "var(--color-surface-1)",
                borderColor: selected ? "var(--color-accent)" : "var(--color-border)",
              }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                style={{
                  background: selected ? "var(--color-accent)" : "var(--color-surface-2)",
                  color: selected ? "#fff" : "var(--color-text-subtle)",
                }}
              >
                {i + 1}
              </span>
              <span
                className="font-medium flex-1 truncate"
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
                className="truncate font-mono shrink-0 max-w-[30%]"
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
          {expanded
            ? <><ChevronUp className="w-3 h-3" />收起</>
            : <><ChevronDown className="w-3 h-3" />展开全部 {chapters.length} 章</>
          }
        </button>
      )}
      <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
        ✓ 点击章节可选为测试章节，下一步将用其配置章节页规则
      </p>
    </div>
  );
}

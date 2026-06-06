/**
 * 书籍列表实时解析预览 — 从 WizardStep1UpdateList 提取
 */
import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

import type { UpdateListBookItem } from "../utils/xpathEval";

interface BookListPreviewProps {
  books: UpdateListBookItem[];
}

export function BookListPreview({ books }: BookListPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? books : books.slice(0, 5);

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
          {books.length} 本书
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {visible.map((b, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
            style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ background: "var(--color-surface-2)", color: "var(--color-text-subtle)" }}
            >
              {i + 1}
            </span>
            <span className="flex-1 truncate font-medium" style={{ color: "var(--color-text)" }}>
              {b.name}
            </span>
            {b.date && (
              <span className="shrink-0 text-xs" style={{ color: "var(--color-text-subtle)" }}>
                {b.date}
              </span>
            )}
            <span
              className="max-w-[30%] shrink-0 truncate text-right font-mono"
              style={{ color: "var(--color-text-subtle)", fontSize: 10 }}
              title={b.url}
            >
              {b.url.replace(/^https?:\/\/[^/]+/, "")}
            </span>
          </div>
        ))}
      </div>
      {books.length > 5 && (
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
              展开全部 {books.length} 本
            </>
          )}
        </button>
      )}
      <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
        ✓ 列表解析正确后，点「下一步」从中选择一本书进入目录配置
      </p>
    </div>
  );
}

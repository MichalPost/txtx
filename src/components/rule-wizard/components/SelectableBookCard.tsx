import { useState } from "react";
import { BookOpen, CheckCircle2, ChevronRight } from "lucide-react";

import type { UpdateListBookItem } from "../ruleUtils";

interface SelectableBookCardProps {
  book: UpdateListBookItem;
  index: number;
  selected: boolean;
  onSelect: () => void;
}

export function SelectableBookCard({
  book,
  index,
  selected,
  onSelect,
}: SelectableBookCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      className="flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-muted)]"
      style={{
        background: selected
          ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))"
          : hovered
            ? "var(--color-surface-1)"
            : "var(--color-surface)",
        borderColor: selected
          ? "var(--color-accent)"
          : hovered
            ? "var(--color-border-hover)"
            : "var(--color-border)",
        transform: hovered && !selected ? "translateY(-1px)" : "none",
        boxShadow: hovered ? "var(--shadow-sm)" : "none",
        transition: "all 140ms ease",
      }}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={selected}
      aria-label={`选择第 ${index + 1} 本：${book.name}`}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{
          background: selected ? "var(--color-accent)" : "var(--color-surface-2)",
          color: selected ? "#fff" : "var(--color-text-subtle)",
          border: "1px solid var(--color-border)",
        }}
      >
        {index + 1}
      </span>

      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: selected
            ? "color-mix(in srgb, var(--color-accent) 15%, var(--color-surface-1))"
            : "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
        }}
      >
        <BookOpen
          className="h-3.5 w-3.5"
          style={{ color: selected ? "var(--color-accent)" : "var(--color-text-subtle)" }}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className="truncate text-xs font-medium"
          style={{ color: selected ? "var(--color-accent)" : "var(--color-text)" }}
        >
          {book.name}
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="truncate font-mono text-xs"
            style={{ color: "var(--color-text-subtle)", fontSize: 10 }}
            title={book.url}
          >
            {book.url.replace(/^https?:\/\/[^/]+/, "") || book.url}
          </span>
          {book.date && (
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-xs"
              style={{
                background: "var(--color-surface-2)",
                color: "var(--color-text-subtle)",
                fontSize: 10,
              }}
            >
              {book.date}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0">
        {selected ? (
          <CheckCircle2 className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
        ) : (
          <ChevronRight
            className="h-4 w-4 opacity-40"
            style={{ color: "var(--color-text-subtle)" }}
          />
        )}
      </div>
    </button>
  );
}

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

interface ChapterFallbackRulesProps {
  fallbacks: string[];
  newFallback: string;
  onNewFallbackChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export function ChapterFallbackRules({
  fallbacks,
  newFallback,
  onNewFallbackChange,
  onAdd,
  onRemove,
}: ChapterFallbackRulesProps) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border p-3"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
        内容备用规则（按顺序尝试）
      </span>
      {fallbacks.map((fb, i) => (
        <div key={i} className="flex items-center gap-2">
          <code className="flex-1 truncate font-mono text-xs" style={{ color: "var(--color-text-muted)" }}>
            {fb}
          </code>
          <button
            onClick={() => onRemove(i)}
            className="flex h-5 w-5 items-center justify-center rounded hover:opacity-70"
            style={{ color: "var(--color-danger)" }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            placeholder="//div[@id='content']/text()"
            value={newFallback}
            onChange={(e) => onNewFallbackChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAdd();
            }}
          />
        </div>
        <Button size="sm" variant="secondary" onClick={onAdd} disabled={!newFallback.trim()}>
          <Plus className="h-3.5 w-3.5" />
          添加
        </Button>
      </div>
    </div>
  );
}

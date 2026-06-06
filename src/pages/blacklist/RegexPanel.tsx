import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

import { inlineInputClass, inlineInputStyle, inputFocusHandlers } from "./blacklistUtils";

interface RegexPanelProps {
  patterns: string[];
  onUpdate: (patterns: string[]) => void;
}

export function RegexPanel({ patterns, onUpdate }: RegexPanelProps) {
  const [newRegex, setNewRegex] = useState("");

  const addRegex = () => {
    const r = newRegex.trim();
    if (!r || patterns.includes(r)) return;
    onUpdate([...patterns, r]);
    setNewRegex("");
  };

  const removeRegex = (r: string) => {
    onUpdate(patterns.filter((p) => p !== r));
  };

  return (
    <Card title="正则规则">
      <div className="mb-3 flex gap-2">
        <input
          className={`flex-1 font-mono ${inlineInputClass}`}
          style={inlineInputStyle}
          placeholder="正则表达式"
          value={newRegex}
          onChange={(e) => setNewRegex(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addRegex()}
          {...inputFocusHandlers}
        />
        <Button size="sm" onClick={addRegex}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        {patterns.map((r) => (
          <div
            key={r}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5"
            style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}
          >
            <code
              className="flex-1 truncate font-mono text-xs"
              style={{ color: "var(--color-accent)" }}
            >
              {r}
            </code>
            <button
              onClick={() => removeRegex(r)}
              className="cursor-pointer transition-colors"
              style={{ color: "var(--color-text-muted)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {patterns.length === 0 && (
          <p className="py-3 text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
            在上方输入正则后按 Enter 添加
          </p>
        )}
      </div>
    </Card>
  );
}

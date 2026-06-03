import { useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { inlineInputStyle, inlineInputClass, inputFocusHandlers } from "./blacklistUtils";

interface TagPanelProps {
  tags: string[];
  onUpdate: (tags: string[]) => void;
}

export function TagPanel({ tags, onUpdate }: TagPanelProps) {
  const [newTag, setNewTag] = useState("");

  const addTag = () => {
    const t = newTag.trim();
    if (!t || tags.includes(t)) return;
    onUpdate([...tags, t]);
    setNewTag("");
  };

  const removeTag = (t: string) => {
    onUpdate(tags.filter(x => x !== t));
  };

  return (
    <Card title="标签过滤">
      <div className="flex gap-2 mb-3">
        <input
          className={`flex-1 ${inlineInputClass}`}
          style={inlineInputStyle}
          placeholder="输入标签名按 Enter 添加"
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addTag()}
          {...inputFocusHandlers}
        />
        <Button size="sm" onClick={addTag}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(t => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border"
            style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
          >
            {t}
            <button
              onClick={() => removeTag(t)}
              className="cursor-pointer"
              style={{ color: "var(--color-text-muted)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; }}
            >
              ✕
            </button>
          </span>
        ))}
        {tags.length === 0 && (
          <p className="text-xs py-2 w-full text-center" style={{ color: "var(--color-text-muted)" }}>
            在上方输入标签后按 Enter 添加
          </p>
        )}
      </div>
    </Card>
  );
}

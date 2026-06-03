import { useState } from "react";
import { Plus, Navigation } from "lucide-react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { inlineInputStyle, inlineInputClass, inputFocusHandlers } from "@/pages/blacklist/blacklistUtils";

interface NavKeywordPanelProps {
  keywords: string[];
  onUpdate: (keywords: string[]) => void;
}

export function NavKeywordPanel({ keywords, onUpdate }: NavKeywordPanelProps) {
  const [newKeyword, setNewKeyword] = useState("");

  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (!kw || keywords.includes(kw)) return;
    onUpdate([...keywords, kw]);
    setNewKeyword("");
  };

  const removeKeyword = (kw: string) => {
    onUpdate(keywords.filter(k => k !== kw));
  };

  return (
    <Card
      title="导航行关键词"
      actions={
        <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}>
          {keywords.length} 条
        </span>
      }
    >
      <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--color-text-subtle)" }}>
        从章节末尾向上循环检测，包含以下关键词的行将被剥离（常见：上一章、下一章、返回目录）
      </p>

      {/* Add input */}
      <div className="flex gap-2 mb-3">
        <input
          className={`flex-1 ${inlineInputClass}`}
          style={inlineInputStyle}
          placeholder="输入导航词，Enter 添加"
          value={newKeyword}
          onChange={e => setNewKeyword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addKeyword()}
          {...inputFocusHandlers}
        />
        <Button size="sm" onClick={addKeyword} disabled={newKeyword.trim() === ""}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {keywords.map(kw => (
          <span
            key={kw}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border group"
            style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
          >
            <Navigation className="w-2.5 h-2.5 opacity-50" />
            {kw}
            <button
              onClick={() => removeKeyword(kw)}
              className="ml-0.5 cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity"
              style={{ color: "var(--color-text-muted)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; }}
            >
              ✕
            </button>
          </span>
        ))}
        {keywords.length === 0 && (
          <p className="text-xs py-2 w-full text-center" style={{ color: "var(--color-text-muted)" }}>
            在上方输入关键词后按 Enter 添加
          </p>
        )}
      </div>
    </Card>
  );
}

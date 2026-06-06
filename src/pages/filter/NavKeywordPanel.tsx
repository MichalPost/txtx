import { useState } from "react";
import { ClipboardList, Navigation, Plus, X } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import {
  inlineInputClass,
  inlineInputStyle,
  inputFocusHandlers,
} from "@/pages/blacklist/blacklistUtils";

interface NavKeywordPanelProps {
  keywords: string[];
  onUpdate: (keywords: string[]) => void;
}

export function NavKeywordPanel({ keywords, onUpdate }: NavKeywordPanelProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (!kw || keywords.includes(kw)) return;
    onUpdate([...keywords, kw]);
    setNewKeyword("");
  };

  const removeKeyword = (kw: string) => {
    onUpdate(keywords.filter((k) => k !== kw));
  };

  const handleBulkAdd = () => {
    const lines = bulkText
      .split(/[\r\n,，]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const merged = [...new Set([...keywords, ...lines])];
    onUpdate(merged);
    setBulkText("");
    setBulkMode(false);
  };

  return (
    <Card
      title="导航行关键词"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBulkMode((v) => !v)}
            title="批量添加"
            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors"
            style={{
              borderColor: bulkMode ? "var(--color-accent)" : "var(--color-border)",
              color: bulkMode ? "var(--color-accent)" : "var(--color-text-muted)",
              background: bulkMode ? "var(--color-accent-muted)" : "transparent",
            }}
          >
            <ClipboardList className="h-3 w-3" /> 批量
          </button>
          <span
            className="rounded-lg px-2 py-1 text-xs"
            style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
          >
            {keywords.length} 条
          </span>
        </div>
      }
    >
      <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--color-text-subtle)" }}>
        从章节末尾向上循环检测，包含以下关键词的行将被剥离（常见：上一章、下一章、返回目录）
      </p>

      {/* Bulk add area */}
      {bulkMode && (
        <div
          className="mb-3 flex flex-col gap-2 rounded-xl border p-3"
          style={{ background: "var(--color-surface-1)", borderColor: "var(--color-accent)" }}
        >
          <textarea
            rows={3}
            className="w-full resize-y rounded-lg border px-3 py-2 text-xs focus:outline-none"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
            placeholder={"上一章\n下一章\n返回目录"}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            {...inputFocusHandlers}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
              {
                bulkText
                  .split(/[\r\n,，]+/)
                  .map((l) => l.trim())
                  .filter(Boolean).length
              }{" "}
              条待添加
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => { setBulkMode(false); setBulkText(""); }}
                className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
              >
                <X className="h-3 w-3" /> 取消
              </button>
              <button
                onClick={handleBulkAdd}
                disabled={bulkText.trim() === ""}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs disabled:opacity-40"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                <Plus className="h-3 w-3" /> 批量添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add input */}
      <div className="mb-3 flex gap-2">
        <input
          className={`flex-1 ${inlineInputClass}`}
          style={inlineInputStyle}
          placeholder="输入导航词，Enter 添加"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addKeyword()}
          {...inputFocusHandlers}
        />
        <Button size="sm" onClick={addKeyword} disabled={newKeyword.trim() === ""}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <Navigation className="h-2.5 w-2.5 opacity-50" />
            {kw}
            <button
              onClick={() => removeKeyword(kw)}
              className="ml-0.5 cursor-pointer opacity-50 transition-opacity group-hover:opacity-100"
              style={{ color: "var(--color-text-muted)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
              }}
            >
              ✕
            </button>
          </span>
        ))}
        {keywords.length === 0 && (
          <p
            className="w-full py-2 text-center text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            在上方输入关键词后按 Enter 添加
          </p>
        )}
      </div>
    </Card>
  );
}

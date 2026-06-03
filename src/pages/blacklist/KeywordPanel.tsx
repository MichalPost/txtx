import { useState, useRef, useMemo } from "react";
import Fuse from "fuse.js";
import { Plus, Search, Upload, Download } from "lucide-react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import {
  exportKeywords,
  importKeywordsFromFile,
  inlineInputStyle,
  inlineInputClass,
  inputFocusHandlers,
  inputFocusHandlersSimple,
} from "./blacklistUtils";

interface KeywordPanelProps {
  keywords: string[];
  onUpdate: (keywords: string[]) => void;
}

export function KeywordPanel({ keywords, onUpdate }: KeywordPanelProps) {
  const [search, setSearch] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (!kw || keywords.includes(kw)) return;
    onUpdate([...keywords, kw]);
    setNewKeyword("");
    inputRef.current?.focus();
  };

  const removeKeyword = (kw: string) => {
    onUpdate(keywords.filter(k => k !== kw));
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importKeywordsFromFile(file, keywords, onUpdate);
    e.target.value = "";
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return keywords;
    const fuse = new Fuse(keywords, { threshold: 0.35, includeScore: true });
    return fuse.search(search.trim()).map(r => r.item);
  }, [keywords, search]);

  return (
    <Card
      title="关键词列表"
      className="flex flex-col flex-1 min-h-0"
      bodyClassName="flex flex-col flex-1 min-h-0 overflow-hidden"
      actions={
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={handleImport} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)", background: "transparent" }}
          >
            <Upload className="w-3 h-3" /> 导入
          </button>
          <button
            onClick={() => exportKeywords(keywords)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)", background: "transparent" }}
          >
            <Download className="w-3 h-3" /> 导出
          </button>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--color-text-muted)" }} />
            <input
              className={`pl-7 pr-3 py-1 text-xs w-40 ${inlineInputClass}`}
              style={inlineInputStyle}
              placeholder="搜索关键词..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              {...inputFocusHandlersSimple}
            />
          </div>
        </div>
      }
    >
      {/* Add input */}
      <div className="flex gap-2 mb-3">
        <input
          ref={inputRef}
          className={`flex-1 ${inlineInputClass}`}
          style={inlineInputStyle}
          placeholder="输入关键词后按 Enter 添加"
          value={newKeyword}
          onChange={e => setNewKeyword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addKeyword()}
          {...inputFocusHandlers}
        />
        <Button size="sm" onClick={addKeyword}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Keyword grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {filtered.map(kw => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border"
              style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
            >
              {kw}
              <button
                onClick={() => removeKeyword(kw)}
                className="ml-0.5 cursor-pointer transition-colors hover:opacity-70"
                style={{ color: "var(--color-text-muted)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; }}
              >
                ✕
              </button>
            </span>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs py-4 w-full text-center" style={{ color: "var(--color-text-muted)" }}>
              {search ? `没有匹配「${search}」的关键词` : "在上方输入关键词后按 Enter 添加"}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

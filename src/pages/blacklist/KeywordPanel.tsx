import { useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { ClipboardList, Download, Plus, Search, Upload, X } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

import {
  exportKeywords,
  importKeywordsFromFile,
  inlineInputClass,
  inlineInputStyle,
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
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
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
    onUpdate(keywords.filter((k) => k !== kw));
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importKeywordsFromFile(file, keywords, onUpdate);
    e.target.value = "";
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

  const filtered = useMemo(() => {
    if (!search.trim()) return keywords;
    const fuse = new Fuse(keywords, { threshold: 0.35, includeScore: true });
    return fuse.search(search.trim()).map((r) => r.item);
  }, [keywords, search]);

  return (
    <Card
      title="关键词列表"
      className="flex min-h-0 flex-1 flex-col"
      bodyClassName="flex flex-col flex-1 min-h-0 overflow-hidden"
      actions={
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
              background: "transparent",
            }}
          >
            <Upload className="h-3 w-3" /> 导入
          </button>
          <button
            onClick={() => exportKeywords(keywords)}
            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
              background: "transparent",
            }}
          >
            <Download className="h-3 w-3" /> 导出
          </button>
          <button
            onClick={() => setBulkMode((v) => !v)}
            title="批量添加（每行/逗号分隔）"
            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors"
            style={{
              borderColor: bulkMode ? "var(--color-accent)" : "var(--color-border)",
              color: bulkMode ? "var(--color-accent)" : "var(--color-text-muted)",
              background: bulkMode ? "var(--color-accent-muted)" : "transparent",
            }}
          >
            <ClipboardList className="h-3 w-3" /> 批量
          </button>
          <div className="relative">
            <Search
              className="absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: "var(--color-text-muted)" }}
            />
            <input
              className={`w-40 py-1 pr-3 pl-7 text-xs ${inlineInputClass}`}
              style={inlineInputStyle}
              placeholder="搜索关键词..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              {...inputFocusHandlersSimple}
            />
          </div>
        </div>
      }
    >
      {/* Bulk add area */}
      {bulkMode && (
        <div
          className="mb-3 flex flex-col gap-2 rounded-xl border p-3"
          style={{ background: "var(--color-surface-1)", borderColor: "var(--color-accent)" }}
        >
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            每行一个关键词，或用逗号/顿号分隔，粘贴后点「批量添加」
          </p>
          <textarea
            rows={4}
            className="w-full resize-y rounded-lg border px-3 py-2 text-xs focus:outline-none"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
            placeholder={"关键词1\n关键词2\n关键词3"}
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
          ref={inputRef}
          className={`flex-1 ${inlineInputClass}`}
          style={inlineInputStyle}
          placeholder="输入关键词后按 Enter 添加"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addKeyword()}
          {...inputFocusHandlers}
        />
        <Button size="sm" onClick={addKeyword}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Keyword grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {filtered.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              {kw}
              <button
                onClick={() => removeKeyword(kw)}
                className="ml-0.5 cursor-pointer transition-colors hover:opacity-70"
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
          {filtered.length === 0 && (
            <p
              className="w-full py-4 text-center text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              {search ? `没有匹配「${search}」的关键词` : "在上方输入关键词后按 Enter 添加"}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

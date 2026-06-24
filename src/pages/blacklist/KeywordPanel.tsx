import { useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { ClipboardList, Download, Plus, Search, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

import {
  buildDraftListFeedback,
  formatDraftFeedback,
  splitDraftValues,
} from "./blacklistEditorUtils";
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
  const [inputHint, setInputHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addKeyword = () => {
    const feedback = buildDraftListFeedback([newKeyword], keywords);
    if (feedback.accepted.length === 0) {
      setInputHint(formatDraftFeedback(0, feedback.duplicateValues.length, feedback.emptyCount));
      return;
    }

    onUpdate([...keywords, ...feedback.accepted]);
    setNewKeyword("");
    setInputHint("关键词已加入列表，记得保存配置");
    inputRef.current?.focus();
  };

  const removeKeyword = (value: string) => {
    onUpdate(keywords.filter((keyword) => keyword !== value));
    setInputHint(`已移除关键词「${value}」，变更尚未保存`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importKeywordsFromFile(file, keywords, onUpdate);
    setInputHint("已处理导入内容，请检查列表并保存配置");
    e.target.value = "";
  };

  const handleBulkAdd = () => {
    const feedback = buildDraftListFeedback(splitDraftValues(bulkText), keywords);
    if (feedback.accepted.length === 0) {
      setInputHint(formatDraftFeedback(0, feedback.duplicateValues.length, feedback.emptyCount));
      return;
    }

    onUpdate([...keywords, ...feedback.accepted]);
    setInputHint(
      formatDraftFeedback(
        feedback.accepted.length,
        feedback.duplicateValues.length,
        feedback.emptyCount,
      ) ?? "已批量添加关键词",
    );
    setBulkText("");
    setBulkMode(false);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return keywords;
    const fuse = new Fuse(keywords, { threshold: 0.35, includeScore: true });
    return fuse.search(search.trim()).map((result) => result.item);
  }, [keywords, search]);

  return (
    <Card
      title="关键词列表"
      className="flex min-h-0 flex-1 flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      actions={
        <div className="flex items-center gap-2">
          <label htmlFor="keyword-import-file" className="sr-only">
            导入关键词文本文件
          </label>
          <input
            id="keyword-import-file"
            ref={fileInputRef}
            type="file"
            accept=".txt"
            name="keyword-import-file"
            aria-label="导入关键词文本文件"
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
            onClick={() => setBulkMode((value) => !value)}
            title="批量添加（每行或逗号分隔）"
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
            <label htmlFor="keyword-search" className="sr-only">
              搜索关键词
            </label>
            <input
              id="keyword-search"
              className={`w-40 py-1 pr-3 pl-7 text-xs ${inlineInputClass}`}
              style={inlineInputStyle}
              name="keyword-search"
              aria-label="搜索关键词"
              placeholder="搜索关键词..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              {...inputFocusHandlersSimple}
            />
          </div>
        </div>
      }
    >
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
            name="keyword-bulk-input"
            aria-label="批量添加关键词"
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
              {splitDraftValues(bulkText).filter(Boolean).length} 条待添加
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setBulkMode(false);
                  setBulkText("");
                }}
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

      <div className="mb-3 flex flex-col gap-2">
        <div className="flex gap-2">
          <label htmlFor="new-keyword" className="sr-only">
            新增关键词
          </label>
          <input
            id="new-keyword"
            ref={inputRef}
            className={`flex-1 ${inlineInputClass}`}
            style={inlineInputStyle}
            name="new-keyword"
            aria-label="新增关键词"
            placeholder="输入关键词后按 Enter 添加"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addKeyword()}
            {...inputFocusHandlers}
          />
          <Button size="sm" onClick={addKeyword} aria-label="添加关键词" title="添加关键词">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p
          className="text-xs"
          style={{ color: inputHint ? "var(--color-warning)" : "var(--color-text-subtle)" }}
        >
          {inputHint ?? "适合拦截常见书名、作者、站点活动词，重复值和空值会自动跳过"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {filtered.map((keyword) => (
            <span
              key={keyword}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              {keyword}
              <button
                onClick={() => removeKeyword(keyword)}
                aria-label={`删除关键词 ${keyword}`}
                title={`删除关键词 ${keyword}`}
                className="ml-0.5 cursor-pointer rounded-full p-0.5 transition-colors hover:opacity-70"
                style={{ color: "var(--color-text-muted)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
                }}
              >
                <Trash2 className="h-3 w-3" />
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

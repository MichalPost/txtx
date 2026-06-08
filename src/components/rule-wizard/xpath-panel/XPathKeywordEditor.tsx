import type { KeyboardEvent } from "react";
import { Loader2, Plus, RotateCcw, Wand2, X as XIcon } from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

import type { FieldState } from "../hooks/useXPathFields";
import { KEYWORD_TYPE_LABELS, type KeywordType, type TargetField } from "../xpathTool";

interface XPathKeywordEditorProps {
  activeField: TargetField;
  activeLabel?: string;
  fieldState: FieldState;
  hasKeyword: boolean;
  onAddKeyword: () => void;
  onGenerate: () => void;
  onKeywordChange: (idx: number, val: string) => void;
  onKeywordKeyDown: (e: KeyboardEvent) => void;
  onKeywordRemove: (idx: number) => void;
  onKeywordTypeChange: (keywordType: KeywordType) => void;
  onReset: () => void;
}

export function XPathKeywordEditor({
  activeField,
  activeLabel,
  fieldState,
  hasKeyword,
  onAddKeyword,
  onGenerate,
  onKeywordChange,
  onKeywordKeyDown,
  onKeywordRemove,
  onKeywordTypeChange,
  onReset,
}: XPathKeywordEditorProps) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
          {activeLabel} 定位配置
        </span>
        {(fieldState.generatedXPath || fieldState.anchorXPath || fieldState.error) && (
          <button
            onClick={onReset}
            className="ml-auto flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs transition-colors"
            style={{
              color: "var(--color-text-subtle)",
              borderColor: "var(--color-border)",
              background: "transparent",
            }}
            title="清空此字段重来"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            重置
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <label className="flex-1 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            定位关键字 <span style={{ color: "var(--color-danger)" }}>*</span>
          </label>
          <button
            onClick={onAddKeyword}
            className="flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs transition-colors"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            <Plus className="h-3 w-3" />
            添加
          </button>
        </div>
        {fieldState.keywords.map((kw, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <Input
              placeholder={
                idx === 0
                  ? activeField === "book_name"
                    ? "如：狂武兽尊（书名）"
                    : activeField === "chapter_url"
                      ? "如：/book/12345/1.html（链接片段）"
                      : "如：第一章 无敌从签到开始"
                  : "再添加一个关键字…"
              }
              value={kw}
              onChange={(e) => onKeywordChange(idx, e.target.value)}
              onKeyDown={onKeywordKeyDown}
            />
            {fieldState.keywords.length > 1 && (
              <button
                onClick={() => onKeywordRemove(idx)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
                style={{
                  background: "var(--color-danger-bg)",
                  borderColor: "var(--color-danger)",
                  color: "var(--color-danger)",
                }}
              >
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {fieldState.keywords.length > 1
            ? "多关键字命中任意一个即可（Enter 触发生成）"
            : "从页面源码中复制，按 Enter 快速生成"}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
          关键字类型
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(KEYWORD_TYPE_LABELS) as KeywordType[]).map((kt) => {
            const active = fieldState.keywordType === kt;
            return (
              <button
                key={kt}
                onClick={() => onKeywordTypeChange(kt)}
                className="rounded-lg border px-2.5 py-1 text-xs transition-colors"
                style={{
                  background: active ? "var(--color-accent-muted)" : "var(--color-surface-1)",
                  borderColor: active
                    ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
                    : "var(--color-border)",
                  color: active ? "var(--color-accent)" : "var(--color-text-muted)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {KEYWORD_TYPE_LABELS[kt]}
              </button>
            );
          })}
        </div>
        <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {fieldState.keywordType === "text" && "用元素的可见文本内容定位"}
          {fieldState.keywordType === "href" && "用 <a> 的 href 属性值定位，关键字可以是链接的一部分"}
          {fieldState.keywordType === "class" && "用元素的 class 名定位，适合有唯一 class 的容器"}
        </p>
      </div>

      <Button size="sm" onClick={onGenerate} disabled={!hasKeyword || fieldState.generating}>
        {fieldState.generating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Wand2 className="h-3.5 w-3.5" />
        )}
        {fieldState.generating ? "生成中…" : `生成 ${activeLabel}`}
      </Button>
    </>
  );
}

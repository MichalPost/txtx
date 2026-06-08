import { AlertCircle, CheckCircle2, ClipboardList, Download, Plus, Upload } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import {
  inlineInputClass,
  inlineInputStyle,
  inputFocusHandlers,
} from "@/pages/blacklist/blacklistUtils";

import { BulkAddPanel } from "./BulkAddPanel";
import { PatternListItem } from "./PatternListItem";
import { isValidRegex, useAdPatterns } from "./useAdPatterns";

interface AdPatternPanelProps {
  patterns: string[];
  onUpdate: (patterns: string[]) => void;
}

export function AdPatternPanel({ patterns, onUpdate }: AdPatternPanelProps) {
  const {
    newPattern,
    setNewPattern,
    bulkMode,
    setBulkMode,
    bulkText,
    setBulkText,
    fileInputRef,
    isValid,
    bulkValidCount,
    bulkInvalidCount,
    addPattern,
    removePattern,
    handleBulkAdd,
    handleImport,
    handleExport,
  } = useAdPatterns({ patterns, onUpdate });

  return (
    <Card
      title="广告过滤规则"
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
            onClick={() => setBulkMode((v) => !v)}
            title="批量添加（每行一条正则）"
            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors hover:opacity-80"
            style={{
              borderColor: bulkMode ? "var(--color-accent)" : "var(--color-border)",
              color: bulkMode ? "var(--color-accent)" : "var(--color-text-muted)",
              background: bulkMode ? "var(--color-accent-muted)" : "transparent",
            }}
          >
            <ClipboardList className="h-3 w-3" /> 批量
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors hover:opacity-80"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
              background: "transparent",
            }}
          >
            <Upload className="h-3 w-3" /> 导入
          </button>
          <button
            onClick={handleExport}
            disabled={patterns.length === 0}
            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors hover:opacity-80 disabled:opacity-40"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
              background: "transparent",
            }}
          >
            <Download className="h-3 w-3" /> 导出
          </button>
          <span
            className="rounded-lg px-2 py-1 text-xs"
            style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
          >
            {patterns.length} 条
          </span>
        </div>
      }
    >
      {/* Bulk add area */}
      {bulkMode && (
        <BulkAddPanel
          bulkText={bulkText}
          bulkValidCount={bulkValidCount}
          bulkInvalidCount={bulkInvalidCount}
          onTextChange={setBulkText}
          onAdd={handleBulkAdd}
          onCancel={() => {
            setBulkMode(false);
            setBulkText("");
          }}
        />
      )}

      {/* Add input */}
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <input
            className={`w-full pr-8 font-mono ${inlineInputClass}`}
            style={{
              ...inlineInputStyle,
              borderColor: !isValid ? "var(--color-danger)" : "var(--color-border)",
            }}
            placeholder="输入正则表达式，Enter 添加"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPattern()}
            {...inputFocusHandlers}
          />
          {newPattern.trim() !== "" && (
            <span className="absolute top-1/2 right-2.5 -translate-y-1/2">
              {isValid ? (
                <CheckCircle2
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--color-success, #22c55e)" }}
                />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" style={{ color: "var(--color-danger)" }} />
              )}
            </span>
          )}
        </div>
        <Button size="sm" onClick={addPattern} disabled={!isValid || newPattern.trim() === ""}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Pattern list */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
        {patterns.map((p) => (
          <PatternListItem key={p} pattern={p} isValid={isValidRegex(p)} onRemove={removePattern} />
        ))}
        {patterns.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "var(--color-surface-2)" }}
            >
              <AlertCircle className="h-4 w-4" style={{ color: "var(--color-text-subtle)" }} />
            </div>
            <p className="text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
              还没有广告过滤规则
            </p>
            <p className="text-center text-xs" style={{ color: "var(--color-text-subtle)" }}>
              添加正则表达式，命中行将被删除
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

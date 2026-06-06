import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Plus, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import {
  inlineInputClass,
  inlineInputStyle,
  inputFocusHandlers,
} from "@/pages/blacklist/blacklistUtils";

interface AdPatternPanelProps {
  patterns: string[];
  onUpdate: (patterns: string[]) => void;
}

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export function AdPatternPanel({ patterns, onUpdate }: AdPatternPanelProps) {
  const [newPattern, setNewPattern] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValid = newPattern.trim() === "" || isValidRegex(newPattern.trim());

  const addPattern = () => {
    const p = newPattern.trim();
    if (!p || patterns.includes(p) || !isValidRegex(p)) return;
    onUpdate([...patterns, p]);
    setNewPattern("");
  };

  const removePattern = (p: string) => {
    onUpdate(patterns.filter((x) => x !== p));
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const newPatterns = text
        .split(/[\r\n]+/)
        .map((l) => l.trim())
        .filter((l) => l && isValidRegex(l));
      onUpdate([...new Set([...patterns, ...newPatterns])]);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExport = () => {
    const blob = new Blob([patterns.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ad_patterns.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group patterns by validity for display
  const { valid, invalid } = useMemo(() => {
    const valid: string[] = [];
    const invalid: string[] = [];
    patterns.forEach((p) => (isValidRegex(p) ? valid.push(p) : invalid.push(p)));
    return { valid, invalid };
  }, [patterns]);
  void valid;
  void invalid;

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
        {patterns.map((p) => {
          const valid = isValidRegex(p);
          return (
            <div
              key={p}
              className="group flex items-center gap-2 rounded-lg border px-3 py-1.5"
              style={{
                background: "var(--color-surface-2)",
                borderColor: valid
                  ? "var(--color-border)"
                  : "color-mix(in srgb, var(--color-danger) 40%, transparent)",
              }}
            >
              {valid ? (
                <CheckCircle2
                  className="h-3 w-3 shrink-0 opacity-40"
                  style={{ color: "var(--color-success, #22c55e)" }}
                />
              ) : (
                <AlertCircle
                  className="h-3 w-3 shrink-0"
                  style={{ color: "var(--color-danger)" }}
                />
              )}
              <code
                className="flex-1 truncate font-mono text-xs"
                style={{ color: "var(--color-accent)" }}
              >
                {p}
              </code>
              <button
                onClick={() => removePattern(p)}
                className="cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
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
          );
        })}
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

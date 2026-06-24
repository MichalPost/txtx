import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

import type { FieldState } from "../hooks/useXPathFields";

interface XPathAnchorEditorProps {
  fieldState: FieldState;
  onAdjust: () => void;
  onAnchorXPathChange: (value: string) => void;
}

export function XPathAnchorEditor({
  fieldState,
  onAdjust,
  onAnchorXPathChange,
}: XPathAnchorEditorProps) {
  return (
    <>
      {fieldState.anchorXPath && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              定位表达式
            </label>
            {!fieldState.error && (
              <span
                className="rounded-full px-1.5 py-0.5 text-xs"
                style={{
                  background: "var(--color-accent-muted)",
                  color: "var(--color-accent)",
                }}
              >
                命中 {fieldState.anchorCount} 个
              </span>
            )}
            {fieldState.error && (
              <span
                className="rounded-full px-1.5 py-0.5 text-xs"
                style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
              >
                可调整后重试
              </span>
            )}
          </div>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                value={fieldState.anchorXPath}
                onChange={(e) => onAnchorXPathChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onAdjust();
                  }
                }}
                placeholder="手动修改后按 Enter 或点调整"
                style={{ fontFamily: "monospace", fontSize: 11 }}
              />
            </div>
            <Button size="sm" variant="secondary" onClick={onAdjust} disabled={fieldState.generating}>
              <RefreshCw className="h-3 w-3" />
              {fieldState.generating ? "调整中..." : "调整"}
            </Button>
          </div>
          {!fieldState.error && fieldState.anchorSamples.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                命中样本（确认是目标元素）：
              </p>
              {fieldState.anchorSamples.slice(0, 3).map((s, i) => (
                <span
                  key={i}
                  className="truncate rounded px-2 py-0.5 text-xs"
                  style={{
                    background: "var(--color-surface-2)",
                    color: "var(--color-text-muted)",
                    fontFamily: "monospace",
                  }}
                  title={s}
                >
                  {i + 1}. {s}
                </span>
              ))}
              {fieldState.anchorCount > 3 && (
                <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                  …共 {fieldState.anchorCount} 个
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {fieldState.error && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{fieldState.error}</span>
        </div>
      )}
    </>
  );
}

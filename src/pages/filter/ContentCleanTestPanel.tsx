import { useMemo, useState } from "react";
import { ChevronRight, FlaskConical, ShieldCheck } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { ContentFilterConfig } from "@/types";

import { runContentFilterPreview } from "./filterPageUtils";

interface ContentCleanTestPanelProps {
  config: ContentFilterConfig;
}

export function ContentCleanTestPanel({ config }: ContentCleanTestPanelProps) {
  const [input, setInput] = useState("");
  const [tested, setTested] = useState(false);

  const preview = useMemo(() => {
    if (!tested || !input.trim()) return null;
    return runContentFilterPreview(input, config);
  }, [tested, input, config]);

  const handleTest = () => setTested(true);
  const handleClear = () => {
    setInput("");
    setTested(false);
  };

  return (
    <Card title="过滤预览">
      <div className="flex flex-col gap-3">
        <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          粘贴章节文本，模拟广告过滤 + 导航行剥离，查看哪些行会被删除
        </p>

        <textarea
          className="w-full resize-none rounded-lg border px-3 py-2 font-mono text-xs transition-colors focus:outline-none"
          name="content-clean-preview-input"
          aria-label="章节内容过滤预览输入"
          style={{
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
            minHeight: 120,
          }}
          placeholder="粘贴章节内容..."
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setTested(false);
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-accent)";
            e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleTest} disabled={!input.trim()}>
            <FlaskConical className="h-3.5 w-3.5" />
            测试过滤
          </Button>
          {tested && (
            <button
              onClick={handleClear}
              className="rounded-lg border px-2 py-1 text-xs transition-colors hover:opacity-80"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
                background: "transparent",
              }}
            >
              清除
            </button>
          )}
          {tested && preview && preview.lines.length > 0 && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs" style={{ color: "var(--color-success, #22c55e)" }}>
                保留 {preview.keptCount} 行
              </span>
              <span className="text-xs" style={{ color: "var(--color-danger)" }}>
                删除 {preview.removedCount} 行
              </span>
            </div>
          )}
        </div>

        {tested && preview?.safetyRollback && (
          <div
            className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
            style={{
              borderColor: "color-mix(in srgb, var(--color-warning, #f59e0b) 35%, transparent)",
              background: "color-mix(in srgb, var(--color-warning, #f59e0b) 10%, transparent)",
              color: "var(--color-warning, #f59e0b)",
            }}
          >
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              本次预览触发安全回退：按当前阈值会误删过多内容，所以系统保留了全部文本。可以收紧广告正则，或先降低阈值再观察结果。
            </span>
          </div>
        )}

        {tested && preview && preview.lines.length > 0 && (
          <div
            className="overflow-y-auto rounded-lg border"
            style={{ borderColor: "var(--color-border)", maxHeight: 280 }}
          >
            {preview.lines.map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-2 border-b px-3 py-1 font-mono text-xs last:border-b-0"
                style={{
                  borderColor: "var(--color-border)",
                  background: r.removed
                    ? "color-mix(in srgb, var(--color-danger) 8%, transparent)"
                    : "transparent",
                  color: r.removed ? "var(--color-danger)" : "var(--color-text)",
                  opacity: r.removed ? 0.85 : 1,
                  textDecoration: r.removed ? "line-through" : "none",
                }}
              >
                <span
                  className="w-4 shrink-0 text-center"
                  style={{ color: "var(--color-text-subtle)", opacity: 0.5 }}
                >
                  {r.removed ? "−" : " "}
                </span>
                <span className="flex-1 leading-relaxed break-all">
                  {r.text || <span style={{ opacity: 0.3 }}>（空行）</span>}
                </span>
                {r.removed && r.matchedRule && (
                  <span
                    className="ml-2 flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
                    style={{
                      background: r.isNavStrip
                        ? "color-mix(in srgb, var(--color-warning, #f59e0b) 15%, transparent)"
                        : "color-mix(in srgb, var(--color-danger) 15%, transparent)",
                      color: r.isNavStrip ? "var(--color-warning, #f59e0b)" : "var(--color-danger)",
                    }}
                  >
                    <ChevronRight className="h-2.5 w-2.5" />
                    {r.isNavStrip ? "导航" : "广告"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {!tested && (
          <div
            className="rounded-lg border border-dashed px-3 py-4 text-xs leading-relaxed"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
              background: "var(--color-surface-2)",
            }}
          >
            建议粘贴一段包含广告尾巴、页脚导航和正常正文的真实章节，这样更容易判断当前规则是否误删。
          </div>
        )}

        {tested && (!preview || preview.lines.length === 0) && (
          <p className="py-4 text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
            请先输入文本
          </p>
        )}
      </div>
    </Card>
  );
}

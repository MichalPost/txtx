/**
 * AiAnalysisPanel — SourceViewer 内嵌的 AI 分析折叠面板
 */
import { Sparkles, Loader2, ChevronUp, AlertCircle } from "lucide-react";
import { validateXPath } from "@/lib/ai";
import { INTENT_PRESETS, type AiXPathResult } from "./useAiXPathAnalysis";

interface AiAnalysisPanelProps {
  html: string;
  aiOpen: boolean;
  setAiOpen: (v: boolean) => void;
  aiIntent: string;
  setAiIntent: (v: string) => void;
  aiLoading: boolean;
  aiResult: AiXPathResult | null;
  setAiResult: (r: AiXPathResult | null) => void;
  aiError: string | null;
  onRunAnalysis: () => void;
  onXPathFromAi: (xpath: string) => void;
}

export function AiAnalysisPanel({
  html,
  aiOpen, setAiOpen,
  aiIntent, setAiIntent,
  aiLoading,
  aiResult, setAiResult,
  aiError,
  onRunAnalysis,
  onXPathFromAi,
}: AiAnalysisPanelProps) {
  return (
    <div style={{ borderTop: "1px solid var(--color-border)" }}>
      {/* Toggle header */}
      <button
        className="w-full flex items-center gap-2 px-1 py-2 text-left transition-colors hover:opacity-80"
        style={{ background: "transparent" }}
        onClick={() => setAiOpen(!aiOpen)}
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
        <span className="flex-1 text-xs font-medium" style={{ color: "var(--color-accent)" }}>
          AI 分析
        </span>
        <ChevronUp
          className="w-3.5 h-3.5 transition-transform"
          style={{
            color: "var(--color-text-muted)",
            transform: aiOpen ? "rotate(0deg)" : "rotate(180deg)",
          }}
        />
      </button>

      {aiOpen && (
        <div className="flex flex-col gap-2.5 pb-3">
          {/* Intent quick presets */}
          <div className="flex flex-wrap gap-1.5">
            {INTENT_PRESETS.map((preset) => (
              <button
                key={preset}
                className="text-xs px-2.5 py-1 rounded-full border transition-all hover:opacity-80"
                style={{
                  background: aiIntent === preset ? "var(--color-accent-muted)" : "var(--color-surface)",
                  borderColor: aiIntent === preset ? "var(--color-accent)" : "var(--color-border)",
                  color: aiIntent === preset ? "var(--color-accent)" : "var(--color-text-muted)",
                }}
                onClick={() => setAiIntent(preset)}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Intent input + run */}
          <div className="flex gap-2">
            <input
              type="text"
              value={aiIntent}
              onChange={(e) => setAiIntent(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onRunAnalysis()}
              placeholder="描述你要提取什么，例如：列表页每本书的链接"
              className="flex-1 border rounded-lg px-3 py-1.5 text-xs focus:outline-none"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
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
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--color-accent)", color: "#fff", boxShadow: "var(--shadow-accent)" }}
              onClick={onRunAnalysis}
              disabled={aiLoading || !html || !aiIntent.trim()}
            >
              {aiLoading
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Sparkles className="w-3 h-3" />}
              {aiLoading ? "分析中..." : "分析"}
            </button>
          </div>

          {/* Error */}
          {aiError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{aiError}</span>
            </div>
          )}

          {/* Result */}
          {aiResult && (
            <div className="flex flex-col gap-2 p-3 rounded-xl border"
              style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}>
              {/* XPath */}
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono truncate"
                  style={{ color: "var(--color-accent)" }}
                  title={aiResult.xpath}>
                  {aiResult.xpath}
                </code>
              </div>

              {/* Validation badge */}
              {aiResult.validation && (
                <div className="flex items-center gap-1.5">
                  {aiResult.validation.error ? (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
                      语法错误
                    </span>
                  ) : aiResult.validation.count === 0 ? (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}>
                      命中 0 个，可能不适用当前页面
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
                      命中 {aiResult.validation.count} 个
                    </span>
                  )}
                  {aiResult.validation.samples.length > 0 && (
                    <span className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                      样本：{aiResult.validation.samples.slice(0, 3).join("、")}
                    </span>
                  )}
                </div>
              )}

              {/* Explanation */}
              {aiResult.explanation && (
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {aiResult.explanation}
                </p>
              )}

              {/* Alternatives */}
              {aiResult.alternatives.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>备选：</span>
                  {aiResult.alternatives.map((alt) => (
                    <button
                      key={alt}
                      className="text-xs px-2 py-0.5 rounded border hover:opacity-80 transition-opacity font-mono"
                      style={{
                        background: "var(--color-surface)",
                        borderColor: "var(--color-border)",
                        color: "var(--color-text-muted)",
                      }}
                      onClick={() => {
                        onXPathFromAi(alt);
                        const v = validateXPath(html, alt);
                        setAiResult({ ...aiResult, xpath: alt, validation: v });
                      }}
                    >
                      {alt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

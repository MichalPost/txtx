/**
 * XPathStatusBar — SourceViewer 底部 XPath 状态栏
 */
import { useState, useEffect } from "react";
import { Copy, Check, ChevronDown } from "lucide-react";
import { XPATH_FIELDS } from "./sourceViewerUtils";
import type { WebsiteConfig } from "@/types";

type XPathField = keyof Pick<
  WebsiteConfig,
  | "list_novel_name"
  | "release_date"
  | "release_url"
  | "novel_name_x"
  | "chapter_url_x"
  | "novel_content"
>;

interface XPathStatusBarProps {
  xpath: string;
  html: string;
  lineCount: number;
  selectedLine: number | null;
  onXPathSelect?: (xpath: string, field: XPathField) => void;
}

export function XPathStatusBar({
  xpath,
  html,
  lineCount,
  selectedLine,
  onXPathSelect,
}: XPathStatusBarProps) {
  const [copied, setCopied] = useState(false);
  const [showFieldPicker, setShowFieldPicker] = useState(false);

  const copyXPath = () => {
    if (!xpath) return;
    navigator.clipboard.writeText(xpath);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => {
    if (!showFieldPicker) return;
    const handler = () => setShowFieldPicker(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showFieldPicker]);

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 border-t shrink-0"
      style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", minHeight: "44px" }}
    >
      {xpath ? (
        <>
          <span className="text-xs shrink-0" style={{ color: "var(--color-text-subtle)" }}>XPath:</span>
          <code
            className="flex-1 text-xs font-mono truncate"
            style={{ color: "var(--color-accent)" }}
            title={xpath}
          >
            {xpath}
          </code>
          <button
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all shrink-0 hover:opacity-80"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: copied ? "var(--color-success, #22c55e)" : "var(--color-text-muted)",
            }}
            onClick={copyXPath}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "已复制" : "复制"}
          </button>

          {onXPathSelect && (
            <div className="relative shrink-0">
              <button
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all hover:opacity-80"
                style={{ background: "var(--color-accent)", borderColor: "transparent", color: "#fff" }}
                onClick={(e) => { e.stopPropagation(); setShowFieldPicker((v) => !v); }}
              >
                填入
                <ChevronDown className="w-3 h-3" />
              </button>

              {showFieldPicker && (
                <div
                  className="absolute bottom-full right-0 mb-1.5 rounded-xl border overflow-hidden"
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                    minWidth: "10rem",
                    zIndex: 10,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {XPATH_FIELDS.map((f) => (
                    <button
                      key={f.key}
                      className="w-full text-left px-3.5 py-2 text-xs transition-colors hover:opacity-80"
                      style={{ color: "var(--color-text)", background: "transparent" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-2)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      onClick={() => { onXPathSelect(xpath, f.key); setShowFieldPicker(false); }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {html ? "点击某行标签以生成 XPath" : "获取源码后点击行以生成 XPath"}
        </span>
      )}

      {html && (
        <span className="ml-auto text-xs tabular-nums shrink-0" style={{ color: "var(--color-text-subtle)" }}>
          {lineCount} 行{selectedLine !== null ? ` · 第 ${selectedLine + 1} 行` : ""}
        </span>
      )}
    </div>
  );
}

/**
 * TestPanel — 规则测试面板
 * 展示命中列表预览 + HTML 源码高亮视图 + XPath 工具入口
 */
import { useState, useMemo } from "react";
import { List, Code2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { validateXPath } from "@/lib/ai";

interface TestField {
  label: string;
  xpath: string;
}

interface TestPanelProps {
  html: string;
  fields: TestField[];
}

type TabId = "results" | "source";

interface FieldResult {
  label: string;
  xpath: string;
  count: number;
  samples: string[];
  error?: string;
}

export function TestPanel({ html, fields }: TestPanelProps) {
  const [tab, setTab] = useState<TabId>("results");
  const [selectedField, setSelectedField] = useState<string | null>(null);

  // Run all XPath validations
  const results: FieldResult[] = useMemo(() => {
    if (!html) return [];
    return fields
      .filter((f) => f.xpath.trim())
      .map((f) => {
        const v = validateXPath(html, f.xpath);
        return { label: f.label, xpath: f.xpath, ...v };
      });
  }, [html, fields]);

  // Build highlighted HTML for source view
  const highlightedHtml = useMemo(() => {
    if (!html || tab !== "source") return "";
    const activeField = selectedField
      ? results.find((r) => r.label === selectedField)
      : results[0];
    if (!activeField?.xpath) return escapeHtml(html);

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const snapshot = document.evaluate(
        activeField.xpath, doc, null,
        XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null
      );
      const matchedTexts = new Set<string>();
      for (let i = 0; i < snapshot.snapshotLength; i++) {
        const node = snapshot.snapshotItem(i);
        const text = (node?.textContent ?? (node as Attr | null)?.value ?? "").trim();
        if (text) matchedTexts.add(text);
      }
      if (matchedTexts.size === 0) return escapeHtml(html);

      // Highlight each matched text in the raw HTML
      let highlighted = escapeHtml(html);
      for (const text of matchedTexts) {
        if (text.length < 2) continue;
        const escaped = escapeHtml(text);
        highlighted = highlighted.replace(
          new RegExp(escapeRegex(escaped), "g"),
          `<mark style="background:var(--color-warning-bg);color:var(--color-warning);border-radius:2px;padding:0 1px;">${escaped}</mark>`
        );
      }
      return highlighted;
    } catch {
      return escapeHtml(html);
    }
  }, [html, tab, selectedField, results]);

  if (!html) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Tab bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div
          className="flex rounded-lg p-0.5 gap-0.5"
          style={{ background: "var(--color-surface-2)" }}
        >
          {([
            { id: "results" as TabId, icon: <List className="w-3 h-3" />, label: "命中预览" },
            { id: "source"  as TabId, icon: <Code2 className="w-3 h-3" />, label: "源码高亮" },
          ]).map(({ id, icon, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background: active ? "var(--color-surface)" : "transparent",
                  color: active ? "var(--color-text)" : "var(--color-text-muted)",
                  boxShadow: active ? "var(--shadow-sm)" : "none",
                }}
              >
                {icon}{label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results tab */}
      {tab === "results" && (
        <div className="flex flex-col gap-2">
          {results.length === 0 ? (
            <p className="text-xs py-3 text-center" style={{ color: "var(--color-text-subtle)" }}>
              所有规则均为空，请先填写规则
            </p>
          ) : (
            results.map((r) => (
              <div
                key={r.label}
                className="flex flex-col gap-1.5 rounded-lg px-3 py-2.5 border"
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                }}
              >
                <div className="flex items-center gap-2">
                  {r.error ? (
                    <XCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-danger)" }} />
                  ) : r.count > 0 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-success)" }} />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-warning)" }} />
                  )}
                  <span className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
                    {r.label}
                  </span>
                  {!r.error && (
                    <span
                      className="ml-auto text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: r.count > 0 ? "var(--color-success-bg)" : "var(--color-warning-bg)",
                        color: r.count > 0 ? "var(--color-success)" : "var(--color-warning)",
                      }}
                    >
                      命中 {r.count} 个
                    </span>
                  )}
                </div>
                {r.error && (
                  <p className="text-xs" style={{ color: "var(--color-danger)" }}>{r.error}</p>
                )}
                {r.samples.length > 0 && (
                  <div className="flex flex-col gap-1 pl-5">
                    {r.samples.slice(0, 5).map((s, i) => (
                      <span
                        key={i}
                        className="text-xs truncate"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {i + 1}. {s}
                      </span>
                    ))}
                  </div>
                )}
                <code
                  className="text-xs font-mono pl-5 truncate"
                  style={{ color: "var(--color-text-subtle)" }}
                >
                  {r.xpath}
                </code>
              </div>
            ))
          )}
        </div>
      )}

      {/* Source tab */}
      {tab === "source" && (
        <div className="flex flex-col gap-2">
          {/* Field selector for highlighting */}
          {results.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              {results.map((r) => {
                const active = (selectedField ?? results[0]?.label) === r.label;
                return (
                  <button
                    key={r.label}
                    onClick={() => setSelectedField(r.label)}
                    className="text-xs px-2.5 py-1 rounded-lg border transition-colors"
                    style={{
                      background: active ? "var(--color-accent-muted)" : "var(--color-surface-1)",
                      borderColor: active
                        ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
                        : "var(--color-border)",
                      color: active ? "var(--color-accent)" : "var(--color-text-muted)",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          )}
          {/* Source code */}
          <div
            className="rounded-xl border overflow-auto font-mono text-xs leading-relaxed p-3"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              maxHeight: 400,
              color: "var(--color-text-muted)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

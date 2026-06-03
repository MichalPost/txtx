import { useState, useMemo } from "react";
import { FlaskConical, ChevronRight } from "lucide-react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import type { ContentFilterConfig } from "@/types";

interface ContentCleanTestPanelProps {
  config: ContentFilterConfig;
}

interface LineResult {
  text: string;
  removed: boolean;
  matchedRule?: string;
  isNavStrip?: boolean;
}

function runFilter(text: string, config: ContentFilterConfig): LineResult[] {
  const lines = text.split(/\r?\n/);

  // Step 1: mark ad pattern matches
  const compiled = config.ad_patterns.map(p => {
    try { return { pattern: p, re: new RegExp(p) }; }
    catch { return null; }
  }).filter(Boolean) as { pattern: string; re: RegExp }[];

  const results: LineResult[] = lines.map(line => {
    for (const { pattern, re } of compiled) {
      if (re.test(line)) {
        return { text: line, removed: true, matchedRule: pattern };
      }
    }
    return { text: line, removed: false };
  });

  // Step 2: nav keyword strip from end
  const navKeywords = config.nav_keywords;
  if (navKeywords.length > 0) {
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i].removed) continue;
      const matchedNav = navKeywords.find(kw => results[i].text.includes(kw));
      if (matchedNav) {
        results[i] = { ...results[i], removed: true, isNavStrip: true, matchedRule: matchedNav };
      } else {
        break; // stop at first non-matching line from end
      }
    }
  }

  // Step 3: safety threshold check
  const kept = results.filter(r => !r.removed).length;
  const ratio = results.length > 0 ? kept / results.length : 1;
  if (ratio < config.safety_threshold) {
    // Revert all removals (safety fallback)
    return results.map(r => ({ ...r, removed: false, matchedRule: undefined, isNavStrip: undefined }));
  }

  return results;
}

export function ContentCleanTestPanel({ config }: ContentCleanTestPanelProps) {
  const [input, setInput] = useState("");
  const [tested, setTested] = useState(false);

  const results = useMemo<LineResult[]>(() => {
    if (!tested || !input.trim()) return [];
    return runFilter(input, config);
  }, [tested, input, config]);

  const removedCount = results.filter(r => r.removed).length;
  const keptCount = results.filter(r => !r.removed).length;

  const handleTest = () => setTested(true);
  const handleClear = () => { setInput(""); setTested(false); };

  return (
    <Card title="过滤预览">
      <div className="flex flex-col gap-3">
        <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          粘贴章节文本，模拟广告过滤 + 导航行剥离，查看哪些行会被删除
        </p>

        <textarea
          className="w-full border rounded-lg px-3 py-2 text-xs font-mono resize-none focus:outline-none transition-colors"
          style={{
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
            minHeight: 120,
          }}
          placeholder="粘贴章节内容..."
          value={input}
          onChange={e => { setInput(e.target.value); setTested(false); }}
          onFocus={e => { e.currentTarget.style.borderColor = "var(--color-accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.boxShadow = "none"; }}
        />

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleTest} disabled={!input.trim()}>
            <FlaskConical className="w-3.5 h-3.5" />
            测试过滤
          </Button>
          {tested && (
            <button
              onClick={handleClear}
              className="text-xs px-2 py-1 rounded-lg border transition-colors hover:opacity-80"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)", background: "transparent" }}
            >
              清除
            </button>
          )}
          {tested && results.length > 0 && (
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-xs" style={{ color: "var(--color-success, #22c55e)" }}>
                保留 {keptCount} 行
              </span>
              <span className="text-xs" style={{ color: "var(--color-danger)" }}>
                删除 {removedCount} 行
              </span>
            </div>
          )}
        </div>

        {/* Diff output */}
        {tested && results.length > 0 && (
          <div
            className="border rounded-lg overflow-y-auto"
            style={{ borderColor: "var(--color-border)", maxHeight: 280 }}
          >
            {results.map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-3 py-1 text-xs font-mono border-b last:border-b-0"
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
                <span className="shrink-0 w-4 text-center" style={{ color: "var(--color-text-subtle)", opacity: 0.5 }}>
                  {r.removed ? "−" : " "}
                </span>
                <span className="flex-1 break-all leading-relaxed">{r.text || <span style={{ opacity: 0.3 }}>（空行）</span>}</span>
                {r.removed && r.matchedRule && (
                  <span
                    className="shrink-0 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ml-2"
                    style={{
                      background: r.isNavStrip
                        ? "color-mix(in srgb, var(--color-warning, #f59e0b) 15%, transparent)"
                        : "color-mix(in srgb, var(--color-danger) 15%, transparent)",
                      color: r.isNavStrip ? "var(--color-warning, #f59e0b)" : "var(--color-danger)",
                    }}
                  >
                    <ChevronRight className="w-2.5 h-2.5" />
                    {r.isNavStrip ? "导航" : "广告"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {tested && results.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: "var(--color-text-muted)" }}>
            请先输入文本
          </p>
        )}
      </div>
    </Card>
  );
}

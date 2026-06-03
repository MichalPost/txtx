/**
 * XPathToolPanel — 关键字定位 XPath 生成工具
 *
 * 流程：
 * 1. 输入定位关键字（从 HTML 中某个已知词定位锚元素）
 * 2. 选择关键字类型（文本/链接/class）
 * 3. 选择目标字段（章节名称/链接/书名/正文）
 * 4. 点生成 → 展示定位表达式 + 各目标 XPath
 * 5. 可手动调整定位表达式后重新推断
 * 6. 确认 → 把生成的 XPath 回调给父组件
 */
import { useState, useCallback } from "react";
import {
  Wand2, RefreshCw, Check, AlertCircle, ChevronRight,
  Info, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import {
  generateXPathFromKeyword, validateGeneratedXPath,
  XPATH_TARGETS, KEYWORD_TYPE_LABELS,
  type KeywordType, type TargetField, type XPathToolResult, type XPathTarget,
} from "./xpathTool";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface XPathToolPanelProps {
  html: string;
  /** Which page context: only show relevant targets */
  page: "catalog" | "chapter";
  /** Called when user confirms — map from field to generated xpath */
  onApply: (results: Partial<Record<TargetField, string>>) => void;
  onClose: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function XPathToolPanel({ html, page, onApply, onClose }: XPathToolPanelProps) {
  const availableTargets = XPATH_TARGETS.filter((t) => t.page === page);

  const [keyword, setKeyword] = useState("");
  const [keywordType, setKeywordType] = useState<KeywordType>("text");
  const [selectedTargets, setSelectedTargets] = useState<Set<TargetField>>(
    () => new Set(availableTargets.map((t) => t.field)),
  );
  const [anchorOverride, setAnchorOverride] = useState(""); // manual adjustment
  const [result, setResult] = useState<XPathToolResult | null>(null);
  const [generated, setGenerated] = useState<Partial<Record<TargetField, string>>>({});
  const [adopted, setAdopted] = useState<Set<TargetField>>(new Set());

  const toggleTarget = (field: TargetField) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field); else next.add(field);
      return next;
    });
  };

  const toggleAdopted = (field: TargetField) => {
    setAdopted((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field); else next.add(field);
      return next;
    });
  };

  const runGenerate = useCallback((anchorXPath?: string) => {
    if (!keyword.trim() || !html) return;
    const r = generateXPathFromKeyword(
      html,
      keyword,
      keywordType,
      Array.from(selectedTargets),
      anchorXPath,
    );
    setResult(r);
    setGenerated(r.generated);
    // Auto-adopt all that have values
    setAdopted(new Set(Object.keys(r.generated) as TargetField[]));
    if (anchorXPath === undefined) setAnchorOverride(r.anchor_xpath);
  }, [html, keyword, keywordType, selectedTargets]);

  const handleAdjust = () => {
    runGenerate(anchorOverride);
  };

  const handleApply = () => {
    const patch: Partial<Record<TargetField, string>> = {};
    for (const field of adopted) {
      const val = generated[field];
      if (val) patch[field] = val;
    }
    onApply(patch);
    onClose();
  };

  const adoptedCount = Array.from(adopted).filter((f) => generated[f]).length;

  return (
    <div
      className="flex flex-col gap-0 rounded-xl border overflow-hidden"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
        <Wand2 className="w-4 h-4 shrink-0" style={{ color: "var(--color-accent)" }} />
        <span className="text-sm font-semibold flex-1" style={{ color: "var(--color-text)" }}>
          XPath 生成工具
        </span>
        <button
          className="text-xs px-2 py-1 rounded hover:opacity-70 transition-opacity"
          style={{ color: "var(--color-text-muted)" }}
          onClick={onClose}
        >
          收起
        </button>
      </div>

      <div className="flex gap-0 overflow-hidden" style={{ minHeight: 320 }}>
        {/* ── Left panel: inputs ─────────────────────────────────────────── */}
        <div
          className="flex flex-col gap-3 p-4 border-r overflow-y-auto"
          style={{ flex: "0 0 52%", borderColor: "var(--color-border)" }}
        >
          {/* Keyword input */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: "var(--color-accent)" }}>
              定位关键字 *
            </label>
            <Input
              placeholder="如：第一章 无敌从签到开始（从源码中复制）"
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setResult(null); }}
            />
          </div>

          {/* Keyword type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              关键字类型
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(KEYWORD_TYPE_LABELS) as KeywordType[]).map((kt) => {
                const active = keywordType === kt;
                return (
                  <button
                    key={kt}
                    onClick={() => { setKeywordType(kt); setResult(null); }}
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
                    {KEYWORD_TYPE_LABELS[kt]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target fields */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              目标 XPath（勾选需要生成的字段）
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {availableTargets.map((t) => {
                const active = selectedTargets.has(t.field);
                return (
                  <button
                    key={t.field}
                    onClick={() => toggleTarget(t.field)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors"
                    style={{
                      background: active ? "var(--color-accent-muted)" : "var(--color-surface-1)",
                      borderColor: active
                        ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
                        : "var(--color-border)",
                      color: active ? "var(--color-accent)" : "var(--color-text-muted)",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {active && <Check className="w-2.5 h-2.5" />}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate button */}
          <Button
            size="sm"
            onClick={() => runGenerate()}
            disabled={!keyword.trim()}
          >
            <Wand2 className="w-3.5 h-3.5" />
            生成
          </Button>

          {/* Anchor expression (adjustable after first generate) */}
          {result && !result.error && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1">
                <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                  定位表达式
                </label>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
                >
                  命中 {result.anchor_count} 个
                </span>
              </div>
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <Input
                    value={anchorOverride}
                    onChange={(e) => setAnchorOverride(e.target.value)}
                    placeholder="可手动调整后点调整重新推断"
                    style={{ fontFamily: "monospace", fontSize: 11 }}
                  />
                </div>
                <Button size="sm" variant="secondary" onClick={handleAdjust}>
                  <RefreshCw className="w-3 h-3" />
                  调整
                </Button>
              </div>
              {result.anchor_samples.length > 0 && (
                <div className="flex flex-col gap-0.5 pl-1">
                  {result.anchor_samples.slice(0, 3).map((s, i) => (
                    <span key={i} className="text-xs truncate" style={{ color: "var(--color-text-subtle)" }}>
                      {i + 1}. {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {result?.error && (
            <div
              className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
            >
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{result.error}</span>
            </div>
          )}
        </div>

        {/* ── Right panel: results + help ────────────────────────────────── */}
        <div className="flex flex-col gap-0 flex-1 overflow-hidden">
          {/* Results */}
          {result && !result.error ? (
            <div className="flex flex-col gap-2.5 p-4 flex-1 overflow-y-auto">
              <p className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                XPath 表达式结果预览
              </p>
              {availableTargets
                .filter((t) => selectedTargets.has(t.field))
                .map((t) => (
                  <ResultRow
                    key={t.field}
                    target={t}
                    html={html}
                    xpath={generated[t.field] ?? ""}
                    adopted={adopted.has(t.field)}
                    onToggleAdopt={() => toggleAdopted(t.field)}
                    onChange={(val) => setGenerated((prev) => ({ ...prev, [t.field]: val }))}
                  />
                ))}
            </div>
          ) : (
            <HelpText page={page} />
          )}

          {/* Apply footer */}
          {result && !result.error && (
            <div
              className="flex items-center gap-2 px-4 py-3 border-t shrink-0"
              style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
            >
              <Button size="sm" onClick={handleApply} disabled={adoptedCount === 0}>
                <ChevronRight className="w-3.5 h-3.5" />
                应用已选（{adoptedCount} 个）
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                取消
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ResultRow ─────────────────────────────────────────────────────────────────

interface ResultRowProps {
  target: XPathTarget;
  html: string;
  xpath: string;
  adopted: boolean;
  onToggleAdopt: () => void;
  onChange: (val: string) => void;
}

function ResultRow({ target, html, xpath, adopted, onToggleAdopt, onChange }: ResultRowProps) {
  const validation = xpath ? validateGeneratedXPath(html, xpath) : null;

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg px-3 py-2.5 border cursor-pointer transition-all"
      style={{
        background: adopted
          ? "color-mix(in srgb, var(--color-accent) 5%, var(--color-surface))"
          : "var(--color-surface-2)",
        borderColor: adopted
          ? "color-mix(in srgb, var(--color-accent) 35%, transparent)"
          : "var(--color-border)",
      }}
      onClick={onToggleAdopt}
    >
      {/* Field label + adopt toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
          * {target.label}
        </span>
        {validation && !validation.error && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{
              background: validation.count > 0 ? "var(--color-success-bg)" : "var(--color-warning-bg)",
              color: validation.count > 0 ? "var(--color-success)" : "var(--color-warning)",
            }}
          >
            命中 {validation.count}
          </span>
        )}
        <div
          className="ml-auto w-4 h-4 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: adopted ? "var(--color-accent)" : "var(--color-border)",
            color: adopted ? "#fff" : "transparent",
          }}
          onClick={(e) => { e.stopPropagation(); onToggleAdopt(); }}
        >
          <Check className="w-2.5 h-2.5" />
        </div>
      </div>

      {/* XPath input (editable) */}
      <div onClick={(e) => e.stopPropagation()}>
        <Input
          value={xpath}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          style={{ fontFamily: "monospace", fontSize: 11 }}
        />
      </div>

      {/* Validation result */}
      {validation && (
        <div className="flex flex-col gap-0.5 pl-1">
          {validation.error ? (
            <div className="flex items-center gap-1 text-xs" style={{ color: "var(--color-danger)" }}>
              <XCircle className="w-3 h-3" /> XPath 语法错误
            </div>
          ) : validation.count === 0 ? (
            <div className="flex items-center gap-1 text-xs" style={{ color: "var(--color-warning)" }}>
              <AlertCircle className="w-3 h-3" /> 未命中，可手动修改表达式
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 text-xs" style={{ color: "var(--color-success)" }}>
                <CheckCircle2 className="w-3 h-3" /> 命中 {validation.count} 个
              </div>
              {validation.samples.slice(0, 2).map((s, i) => (
                <span key={i} className="text-xs truncate pl-4" style={{ color: "var(--color-text-muted)" }}>
                  {i + 1}. {s}
                </span>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Help text ─────────────────────────────────────────────────────────────────

function HelpText({ page }: { page: "catalog" | "chapter" }) {
  return (
    <div
      className="flex-1 p-4 overflow-y-auto text-xs leading-relaxed"
      style={{ color: "var(--color-text-muted)" }}
    >
      <p className="font-semibold mb-2" style={{ color: "var(--color-text)" }}>
        XPath 表达式结果预览
      </p>
      <p className="mb-3">
        XPath 生成的原理：根据页面中的
        <span style={{ color: "var(--color-accent)" }}>关键字定位元素</span>
        （可能会匹配到多组元素），再选择合适的元素分析获得 XPath 路径。
      </p>
      {page === "catalog" ? (
        <>
          <p className="mb-2">
            可根据 HTML 代码中的关键字对元素进行定位，目录页通常用某一章的
            <strong>章节名称</strong>来作关键字，若章节名仅为序号时，可用某一单的的链接作关键字（同时关键字类型改为跳转链接）。
          </p>
          <p className="mb-2 font-medium" style={{ color: "var(--color-text)" }}>操作步骤：</p>
          <ol className="list-decimal list-inside flex flex-col gap-1">
            <li>指定定位关键字（从源码中复制，具有唯一性的更佳）</li>
            <li>选择关键字类型（文本内容/跳转链接/class属性）</li>
            <li>勾选要生成的目标字段</li>
            <li>点击"生成"查看结果，可调整定位表达式后点"调整"重新推断</li>
            <li>确认无误后点"应用"，结果会填入对应规则字段</li>
          </ol>
        </>
      ) : (
        <>
          <p className="mb-2">
            章节页通常用小说正文中某段关键词来作关键字。若图片元素中存在特殊的属性值，也可作关键字（关键字类型改为 class）。
          </p>
          <div
            className="flex items-start gap-2 mt-3 px-3 py-2 rounded-lg"
            style={{ background: "var(--color-warning-bg)" }}
          >
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--color-warning)" }} />
            <p style={{ color: "var(--color-warning)" }}>
              指定定位关键字时尽量从源代码中复制，可能源代码中是相对路径链接。
            </p>
          </div>
        </>
      )}
      <p className="mt-3 text-xs" style={{ color: "var(--color-text-subtle)" }}>
        带 * 项为本窗口最终要获取的数据（红色比蓝色更重要）。
      </p>
    </div>
  );
}

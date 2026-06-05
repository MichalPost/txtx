/**
 * XPathToolPanel — 关键字定位 XPath 生成工具
 *
 * UX 设计：
 * - 每个字段独立维护关键字 + 类型 + 定位表达式 + 生成结果
 * - 左侧字段 tab 切换，右侧始终显示所有字段的结果占位卡片
 * - Enter 触发生成，生成按钮有 loading 状态
 * - 定位表达式无论出错与否均显示调整入口
 * - 右侧 XPath 编辑框实时重新验证（onBlur）
 * - 右侧卡片点击跳转字段 tab，编辑框点击不跳转
 * - 字段可以单独重置
 */
import { useState, useCallback, useEffect } from "react";
import {
  Wand2, RefreshCw, Check, AlertCircle, ChevronRight,
  Info, CheckCircle2, XCircle, Plus, X as XIcon,
  RotateCcw, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import {
  generateXPathFromKeyword, validateGeneratedXPath,
  XPATH_TARGETS, KEYWORD_TYPE_LABELS,
  type KeywordType, type TargetField, type XPathTarget,
} from "./xpathTool";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FieldState {
  keywords: string[];
  keywordType: KeywordType;
  anchorXPath: string;
  anchorCount: number;
  anchorSamples: string[];
  generatedXPath: string;
  adopted: boolean;
  error: string;
  generating: boolean;
}

function defaultFieldState(): FieldState {
  return {
    keywords: [""],
    keywordType: "text",
    anchorXPath: "",
    anchorCount: 0,
    anchorSamples: [],
    generatedXPath: "",
    adopted: false,
    error: "",
    generating: false,
  };
}

interface XPathToolPanelProps {
  html: string;
  page: "catalog" | "chapter" | "update_list";
  onApply: (results: Partial<Record<TargetField, string>>) => void;
  onClose: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function XPathToolPanel({ html, page, onApply, onClose }: XPathToolPanelProps) {
  const availableTargets = XPATH_TARGETS.filter((t) => t.page === page);

  const [fields, setFields] = useState<Record<TargetField, FieldState>>(
    () => Object.fromEntries(
      availableTargets.map((t) => [t.field, defaultFieldState()])
    ) as Record<TargetField, FieldState>
  );

  const [activeField, setActiveField] = useState<TargetField>(availableTargets[0]?.field ?? "chapter_name");

  const fs = fields[activeField];

  // ── patch helpers ──────────────────────────────────────────────────────────

  const patchField = useCallback((field: TargetField, patch: Partial<FieldState>) =>
    setFields((prev) => ({ ...prev, [field]: { ...prev[field], ...patch } })), []);

  const patchActive = useCallback((patch: Partial<FieldState>) =>
    patchField(activeField, patch), [patchField, activeField]);

  // ── keyword ops ────────────────────────────────────────────────────────────

  const setKwAt = (idx: number, val: string) =>
    patchActive({ keywords: fs.keywords.map((k, i) => (i === idx ? val : k)), error: "" });

  const addKw = () => {
    patchActive({ keywords: [...fs.keywords, ""] });
  };

  const removeKw = (idx: number) =>
    patchActive({ keywords: fs.keywords.length > 1 ? fs.keywords.filter((_, i) => i !== idx) : fs.keywords });

  // ── generate ───────────────────────────────────────────────────────────────

  const runGenerate = useCallback((field: TargetField, anchorOverride?: string) => {
    const state = fields[field];
    const activeKws = state.keywords.filter((k) => k.trim());
    if (!activeKws.length || !html) return;

    // Show generating state (DOM parse can be slow for large pages)
    patchField(field, { generating: true, error: "" });

    // Defer to let React paint the loading state first
    setTimeout(() => {
      const r = generateXPathFromKeyword(
        html,
        activeKws,
        state.keywordType,
        [field],
        anchorOverride,
      );
      patchField(field, {
        generating: false,
        anchorXPath: anchorOverride ?? r.anchor_xpath,
        anchorCount: r.anchor_count,
        anchorSamples: r.anchor_samples,
        generatedXPath: r.generated[field] ?? state.generatedXPath,
        adopted: !!r.generated[field],
        error: r.error ?? "",
      });
    }, 30);
  }, [fields, html, patchField]);

  const handleAdjust = (field: TargetField) =>
    runGenerate(field, fields[field].anchorXPath);

  // ── reset field ────────────────────────────────────────────────────────────

  const resetField = (field: TargetField) => patchField(field, defaultFieldState());

  // ── apply ──────────────────────────────────────────────────────────────────

  const handleApply = () => {
    const patch: Partial<Record<TargetField, string>> = {};
    for (const t of availableTargets) {
      const f = fields[t.field];
      if (f.adopted && f.generatedXPath) patch[t.field] = f.generatedXPath;
    }
    onApply(patch);
    onClose();
  };

  const adoptedCount = availableTargets.filter(
    (t) => fields[t.field].adopted && fields[t.field].generatedXPath
  ).length;

  const hasKeyword = fs.keywords.some((k) => k.trim());
  const anyGenerating = availableTargets.some((t) => fields[t.field].generating);

  // Esc closes the panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── enter key in keyword input ─────────────────────────────────────────────
  const handleKwKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && hasKeyword && !fs.generating) {
      e.preventDefault();
      runGenerate(activeField);
    }
  };

  return (
    <div
      className="flex flex-col gap-0 rounded-xl border overflow-hidden"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-md)",
        height: "100%",
        maxHeight: "calc(100vh - 64px)",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
        <Wand2 className="w-4 h-4 shrink-0" style={{ color: "var(--color-accent)" }} />
        <span className="text-sm font-semibold flex-1" style={{ color: "var(--color-text)" }}>
          XPath 生成工具
        </span>
        {/* 全局应用按钮也放 header，减少找按钮的路程 */}
        {adoptedCount > 0 && (
          <button
            onClick={handleApply}
            className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg transition-colors font-medium"
            style={{
              background: "var(--color-accent)",
              color: "#fff",
            }}
          >
            <ChevronRight className="w-3 h-3" />
            应用 {adoptedCount} 个
          </button>
        )}
        <button
          className="text-xs px-2 py-1 rounded hover:opacity-70 transition-opacity"
          style={{ color: "var(--color-text-muted)" }}
          onClick={onClose}
        >
          收起
        </button>
      </div>

      <div className="flex gap-0 overflow-hidden flex-1 min-h-0" style={{ minHeight: 340 }}>

        {/* ── Left panel ────────────────────────────────────────────────── */}
        <div
          className="flex flex-col gap-0 border-r"
          style={{ flex: "0 0 52%", borderColor: "var(--color-border)" }}
        >
          {/* 字段 tab */}
          <div
            className="flex border-b shrink-0"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
          >
            {availableTargets.map((t) => {
              const active = activeField === t.field;
              const f = fields[t.field];
              const statusColor = f.generating
                ? "var(--color-accent)"
                : f.error
                  ? "var(--color-danger)"
                  : f.generatedXPath
                    ? "var(--color-success)"
                    : undefined;
              return (
                <button
                  key={t.field}
                  onClick={() => setActiveField(t.field)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all border-b-2 shrink-0"
                  style={{
                    background: active ? "var(--color-surface)" : "transparent",
                    borderBottomColor: active ? "var(--color-accent)" : "transparent",
                    color: active ? "var(--color-accent)" : (statusColor ?? "var(--color-text-muted)"),
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {/* status dot */}
                  {statusColor && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: statusColor }}
                    />
                  )}
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* 配置区 */}
          <div className="flex flex-col gap-3 p-4 overflow-y-auto flex-1">

            {/* 字段标题 + 重置 */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                {availableTargets.find((t) => t.field === activeField)?.label} 定位配置
              </span>
              {(fs.generatedXPath || fs.anchorXPath || fs.error) && (
                <button
                  onClick={() => resetField(activeField)}
                  className="flex items-center gap-1 text-xs ml-auto px-1.5 py-0.5 rounded border transition-colors"
                  style={{
                    color: "var(--color-text-subtle)",
                    borderColor: "var(--color-border)",
                    background: "transparent",
                  }}
                  title="清空此字段重来"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  重置
                </button>
              )}
            </div>

            {/* 关键字列表 */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium flex-1" style={{ color: "var(--color-text-muted)" }}>
                  定位关键字 <span style={{ color: "var(--color-danger)" }}>*</span>
                </label>
                <button
                  onClick={addKw}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border transition-colors"
                  style={{
                    background: "var(--color-surface-2)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  <Plus className="w-3 h-3" />
                  添加
                </button>
              </div>
              {fs.keywords.map((kw, idx) => (
                <div key={idx} className="flex gap-1.5 items-center">
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
                    onChange={(e) => setKwAt(idx, e.target.value)}
                    onKeyDown={handleKwKeyDown}
                  />
                  {fs.keywords.length > 1 && (
                    <button
                      onClick={() => removeKw(idx)}
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full border"
                      style={{
                        background: "var(--color-danger-bg)",
                        borderColor: "var(--color-danger)",
                        color: "var(--color-danger)",
                      }}
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {fs.keywords.length > 1 && (
                <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                  多关键字命中任意一个即可（Enter 触发生成）
                </p>
              )}
              {fs.keywords.length === 1 && (
                <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                  从页面源码中复制，按 Enter 快速生成
                </p>
              )}
            </div>

            {/* 关键字类型 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                关键字类型
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {(Object.keys(KEYWORD_TYPE_LABELS) as KeywordType[]).map((kt) => {
                  const active = fs.keywordType === kt;
                  return (
                    <button
                      key={kt}
                      onClick={() => patchActive({ keywordType: kt, error: "" })}
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
              {/* 类型提示 */}
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-subtle)" }}>
                {fs.keywordType === "text" && "用元素的可见文本内容定位"}
                {fs.keywordType === "href" && "用 <a> 的 href 属性值定位，关键字可以是链接的一部分"}
                {fs.keywordType === "class" && "用元素的 class 名定位，适合有唯一 class 的容器"}
              </p>
            </div>

            {/* 生成按钮 */}
            <Button
              size="sm"
              onClick={() => runGenerate(activeField)}
              disabled={!hasKeyword || fs.generating}
            >
              {fs.generating
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Wand2 className="w-3.5 h-3.5" />
              }
              {fs.generating ? "生成中…" : `生成 ${availableTargets.find((t) => t.field === activeField)?.label}`}
            </Button>

            {/* 定位表达式 — 无论出错与否都显示（有值就显示） */}
            {fs.anchorXPath && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                    定位表达式
                  </label>
                  {!fs.error && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
                    >
                      命中 {fs.anchorCount} 个
                    </span>
                  )}
                  {fs.error && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
                    >
                      可调整后重试
                    </span>
                  )}
                </div>
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      value={fs.anchorXPath}
                      onChange={(e) => patchActive({ anchorXPath: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleAdjust(activeField); }
                      }}
                      placeholder="手动修改后按 Enter 或点调整"
                      style={{ fontFamily: "monospace", fontSize: 11 }}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleAdjust(activeField)}
                    disabled={fs.generating}
                  >
                    <RefreshCw className="w-3 h-3" />
                    调整
                  </Button>
                </div>
                {/* 锚点采样 */}
                {!fs.error && fs.anchorSamples.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                      命中样本（确认是目标元素）：
                    </p>
                    {fs.anchorSamples.slice(0, 3).map((s, i) => (
                      <span
                        key={i}
                        className="text-xs truncate px-2 py-0.5 rounded"
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
                    {fs.anchorCount > 3 && (
                      <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                        …共 {fs.anchorCount} 个
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 错误提示 */}
            {fs.error && (
              <div
                className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
              >
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{fs.error}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel: all field results ──────────────────────────────── */}
        <div className="flex flex-col gap-0 flex-1 overflow-hidden">
          <div className="flex flex-col gap-2.5 p-4 flex-1 overflow-y-auto">
            {/* 无任何结果时显示简短引导，保留结果卡片占位 */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                XPath 表达式结果
              </p>
              {anyGenerating && (
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: "var(--color-accent)" }} />
              )}
            </div>

            {/* 始终渲染所有字段卡片 */}
            {availableTargets.map((t) => {
              const f = fields[t.field];
              const isActive = activeField === t.field;
              return (
                <ResultRow
                  key={t.field}
                  target={t}
                  html={html}
                  xpath={f.generatedXPath}
                  adopted={f.adopted}
                  isActive={isActive}
                  generating={f.generating}
                  onActivate={() => setActiveField(t.field)}
                  onToggleAdopt={() => patchField(t.field, { adopted: !f.adopted })}
                  onChange={(val) => patchField(t.field, { generatedXPath: val })}
                />
              );
            })}

            {/* 无结果时的引导文字 */}
            {availableTargets.every((t) => !fields[t.field].generatedXPath) && (
              <QuickGuide page={page} />
            )}
          </div>

          {/* Apply footer */}
          <div
            className="flex items-center gap-2 px-4 py-3 border-t shrink-0"
            style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
          >
            <Button
              size="sm"
              onClick={handleApply}
              disabled={adoptedCount === 0}
            >
              <ChevronRight className="w-3.5 h-3.5" />
              应用已选（{adoptedCount} 个）
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              取消
            </Button>
          </div>
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
  isActive: boolean;
  generating: boolean;
  onActivate: () => void;
  onToggleAdopt: () => void;
  onChange: (val: string) => void;
}

function ResultRow({
  target, html, xpath, adopted, isActive, generating, onActivate, onToggleAdopt, onChange,
}: ResultRowProps) {
  // Validate on mount/xpath change; re-validate on blur after manual edit
  const [localXPath, setLocalXPath] = useState(xpath);
  const [validation, setValidation] = useState(() =>
    xpath ? validateGeneratedXPath(html, xpath) : null
  );
  const [samplesExpanded, setSamplesExpanded] = useState(false);

  // Sync when parent xpath changes (new generation)
  useEffect(() => {
    setLocalXPath(xpath);
    setValidation(xpath ? validateGeneratedXPath(html, xpath) : null);
    setSamplesExpanded(false);
  }, [xpath, html]);

  const handleBlur = () => {
    if (localXPath !== xpath) onChange(localXPath);
    setValidation(localXPath ? validateGeneratedXPath(html, localXPath) : null);
  };

  const handleChange = (val: string) => {
    setLocalXPath(val);
    onChange(val);
    // Validate on every keystroke for immediate feedback
    setValidation(val ? validateGeneratedXPath(html, val) : null);
  };

  const empty = !xpath && !generating;

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg px-3 py-2.5 border transition-all"
      style={{
        background: isActive
          ? "color-mix(in srgb, var(--color-accent) 4%, var(--color-surface))"
          : adopted
            ? "color-mix(in srgb, var(--color-accent) 5%, var(--color-surface))"
            : "var(--color-surface-2)",
        borderColor: isActive
          ? "var(--color-accent)"
          : adopted
            ? "color-mix(in srgb, var(--color-accent) 35%, transparent)"
            : "var(--color-border)",
        cursor: "pointer",
        opacity: empty ? 0.55 : 1,
      }}
      onClick={onActivate}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-medium"
          style={{ color: isActive ? "var(--color-accent)" : "var(--color-text)" }}
        >
          {target.label}
        </span>

        {generating && (
          <Loader2 className="w-3 h-3 animate-spin" style={{ color: "var(--color-accent)" }} />
        )}

        {!generating && validation && !validation.error && (
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
        {!generating && validation?.error && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
          >
            语法错误
          </span>
        )}
        {empty && (
          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            点左侧生成
          </span>
        )}

        {/* 勾选按钮 */}
        {!empty && (
          <button
            className="ml-auto w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all"
            style={{
              background: adopted ? "var(--color-accent)" : "var(--color-surface)",
              borderColor: adopted
                ? "var(--color-accent)"
                : "var(--color-border)",
            }}
            onClick={(e) => { e.stopPropagation(); onToggleAdopt(); }}
            title={adopted ? "取消应用此字段" : "应用此字段"}
          >
            {adopted && <Check className="w-3 h-3" style={{ color: "#fff" }} />}
          </button>
        )}
      </div>

      {/* XPath 编辑框 */}
      {!empty && !generating && (
        <div onClick={(e) => e.stopPropagation()}>
          <Input
            value={localXPath}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder="—"
            style={{ fontFamily: "monospace", fontSize: 11 }}
          />
        </div>
      )}

      {/* 生成占位 */}
      {generating && (
        <div
          className="h-7 rounded animate-pulse"
          style={{ background: "var(--color-border)" }}
        />
      )}

      {/* 验证结果 */}
      {!generating && validation && (
        <div className="flex flex-col gap-0.5 pl-1">
          {validation.error ? (
            <div className="flex items-center gap-1 text-xs" style={{ color: "var(--color-danger)" }}>
              <XCircle className="w-3 h-3 shrink-0" />
              <span className="truncate">{validation.error}</span>
            </div>
          ) : validation.count === 0 ? (
            <div className="flex items-center gap-1 text-xs" style={{ color: "var(--color-warning)" }}>
              <AlertCircle className="w-3 h-3 shrink-0" /> 未命中，可手动修改后切回左侧点调整
            </div>
          ) : (
            <>
              {/* 可点击的"命中 N 个"行 */}
              <button
                className="flex items-center gap-1 text-xs w-fit rounded px-0.5 -mx-0.5 transition-opacity hover:opacity-70"
                style={{ color: "var(--color-success)" }}
                onClick={(e) => { e.stopPropagation(); setSamplesExpanded((v) => !v); }}
                title={samplesExpanded ? "收起命中列表" : "展开查看全部命中"}
              >
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                命中 {validation.count} 个
                {validation.count > 2 && (
                  samplesExpanded
                    ? <ChevronUp className="w-3 h-3 shrink-0" />
                    : <ChevronDown className="w-3 h-3 shrink-0" />
                )}
              </button>
              {/* 样本列表 */}
              {(samplesExpanded ? validation.samples : validation.samples.slice(0, 2)).map((s, i) => (
                <span
                  key={i}
                  className="text-xs truncate pl-4"
                  style={{ color: "var(--color-text-muted)" }}
                  title={s}
                >
                  {i + 1}. {s}
                </span>
              ))}
              {/* 未展开时显示"还有 N 条" */}
              {!samplesExpanded && validation.count > 2 && (
                <button
                  className="text-xs pl-4 text-left hover:opacity-70 transition-opacity"
                  style={{ color: "var(--color-text-subtle)" }}
                  onClick={(e) => { e.stopPropagation(); setSamplesExpanded(true); }}
                >
                  …还有 {validation.count - 2} 条，点击展开
                </button>
              )}
              {/* 展开后显示折叠入口 */}
              {samplesExpanded && validation.count > 2 && (
                <button
                  className="text-xs pl-4 text-left hover:opacity-70 transition-opacity"
                  style={{ color: "var(--color-text-subtle)" }}
                  onClick={(e) => { e.stopPropagation(); setSamplesExpanded(false); }}
                >
                  收起
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Quick guide (shown when no results yet) ───────────────────────────────────

function QuickGuide({ page }: { page: "catalog" | "chapter" | "update_list" }) {
  return (
    <div
      className="rounded-lg px-3 py-3 text-xs leading-relaxed mt-1"
      style={{ background: "var(--color-surface-1)", color: "var(--color-text-muted)" }}
    >
      {page === "update_list" ? (
        <>
          <p className="font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            快速开始
          </p>
          <ol className="list-decimal list-inside flex flex-col gap-1">
            <li>切换到「书名」，输入列表中某本书的名字，按 <kbd className="px-1 rounded border" style={{ borderColor: "var(--color-border)", fontSize: 10 }}>Enter</kbd></li>
            <li>确认"定位样本"是目标书名，不对就调整表达式</li>
            <li>切换到「书籍链接」，输入链接片段，类型选"跳转链接"</li>
            <li>「更新日期」可选，用日期文字定位</li>
            <li>右侧命中数 &gt; 0，勾选后点应用</li>
          </ol>
        </>
      ) : page === "catalog" ? (
        <>
          <p className="font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            快速开始
          </p>
          <ol className="list-decimal list-inside flex flex-col gap-1">
            <li>左侧切换到目标字段，输入关键字，按 <kbd className="px-1 rounded border" style={{ borderColor: "var(--color-border)", fontSize: 10 }}>Enter</kbd></li>
            <li>确认"定位样本"是目标元素，不对就调整表达式</li>
            <li>右侧命中数 &gt; 0 即可，勾选字段后点应用</li>
          </ol>
          <div className="flex flex-col gap-0.5 mt-2" style={{ color: "var(--color-text-subtle)" }}>
            <p>💡 章节名/链接：用章节名作关键字，类型选"文本内容"</p>
            <p>💡 书籍名称：用书名作关键字，通常自动命中 h1</p>
          </div>
        </>
      ) : (
        <>
          <p className="font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            快速开始
          </p>
          <p className="mb-1">从正文中复制一段关键文字，类型选"文本内容"，按 Enter 生成。</p>
          <div
            className="flex items-start gap-2 mt-2 px-2.5 py-2 rounded-lg"
            style={{ background: "var(--color-warning-bg)" }}
          >
            <Info className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "var(--color-warning)" }} />
            <p style={{ color: "var(--color-warning)" }}>
              尽量从页面源码中复制，链接可能是相对路径。
            </p>
          </div>
        </>
      )}
    </div>
  );
}

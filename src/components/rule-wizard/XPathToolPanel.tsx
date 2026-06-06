/**
 * XPathToolPanel — 关键字定位 XPath 生成工具
 */
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Wand2,
  X as XIcon,
} from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

import { XPathQuickGuide } from "./components/XPathQuickGuide";
import { XPathResultRow } from "./components/XPathResultRow";
import { useXPathFields } from "./hooks/useXPathFields";
import { useXPathGenerate } from "./hooks/useXPathGenerate";
import {
  KEYWORD_TYPE_LABELS,
  XPATH_TARGETS,
  type KeywordType,
  type TargetField,
} from "./xpathTool";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface XPathToolPanelProps {
  html: string;
  page: "catalog" | "chapter" | "update_list";
  onApply: (results: Partial<Record<TargetField, string>>) => void;
  onClose: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function XPathToolPanel({ html, page, onApply, onClose }: XPathToolPanelProps) {
  const availableTargets = XPATH_TARGETS.filter((t) => t.page === page);

  const { fields, patchField, resetField } = useXPathFields(availableTargets);
  const { runGenerate, handleAdjust } = useXPathGenerate(html, fields, patchField);

  const [activeField, setActiveField] = useState<TargetField>(
    availableTargets[0]?.field ?? "chapter_name",
  );

  const fs = fields[activeField];

  // ── patch active field ─────────────────────────────────────────────────────

  const patchActive = useCallback(
    (patch: Parameters<typeof patchField>[1]) => patchField(activeField, patch),
    [patchField, activeField],
  );

  // ── keyword ops ────────────────────────────────────────────────────────────

  const setKwAt = (idx: number, val: string) =>
    patchActive({ keywords: fs.keywords.map((k, i) => (i === idx ? val : k)), error: "" });

  const addKw = () => patchActive({ keywords: [...fs.keywords, ""] });

  const removeKw = (idx: number) =>
    patchActive({
      keywords: fs.keywords.length > 1 ? fs.keywords.filter((_, i) => i !== idx) : fs.keywords,
    });

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
    (t) => fields[t.field].adopted && fields[t.field].generatedXPath,
  ).length;

  const hasKeyword = fs.keywords.some((k) => k.trim());
  const anyGenerating = availableTargets.some((t) => fields[t.field].generating);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleKwKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && hasKeyword && !fs.generating) {
      e.preventDefault();
      runGenerate(activeField);
    }
  };

  return (
    <div
      className="flex flex-col gap-0 overflow-hidden rounded-xl border"
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
        className="flex items-center gap-2 border-b px-4 py-3"
        style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
        <Wand2 className="h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
        <span className="flex-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          XPath 生成工具
        </span>
        {adoptedCount > 0 && (
          <button
            onClick={handleApply}
            className="flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            <ChevronRight className="h-3 w-3" />
            应用 {adoptedCount} 个
          </button>
        )}
        <button
          className="rounded px-2 py-1 text-xs transition-opacity hover:opacity-70"
          style={{ color: "var(--color-text-muted)" }}
          onClick={onClose}
        >
          收起
        </button>
      </div>

      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden" style={{ minHeight: 340 }}>
        {/* ── Left panel ────────────────────────────────────────────────── */}
        <div
          className="flex flex-col gap-0 border-r"
          style={{ flex: "0 0 52%", borderColor: "var(--color-border)" }}
        >
          {/* 字段 tab */}
          <div
            className="flex shrink-0 border-b"
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
                  className="flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-all"
                  style={{
                    background: active ? "var(--color-surface)" : "transparent",
                    borderBottomColor: active ? "var(--color-accent)" : "transparent",
                    color: active
                      ? "var(--color-accent)"
                      : (statusColor ?? "var(--color-text-muted)"),
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {statusColor && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: statusColor }}
                    />
                  )}
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* 配置区 */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                {availableTargets.find((t) => t.field === activeField)?.label} 定位配置
              </span>
              {(fs.generatedXPath || fs.anchorXPath || fs.error) && (
                <button
                  onClick={() => resetField(activeField)}
                  className="ml-auto flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs transition-colors"
                  style={{
                    color: "var(--color-text-subtle)",
                    borderColor: "var(--color-border)",
                    background: "transparent",
                  }}
                  title="清空此字段重来"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  重置
                </button>
              )}
            </div>

            {/* 关键字列表 */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label
                  className="flex-1 text-xs font-medium"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  定位关键字 <span style={{ color: "var(--color-danger)" }}>*</span>
                </label>
                <button
                  onClick={addKw}
                  className="flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs transition-colors"
                  style={{
                    background: "var(--color-surface-2)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  <Plus className="h-3 w-3" />
                  添加
                </button>
              </div>
              {fs.keywords.map((kw, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
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
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        background: "var(--color-danger-bg)",
                        borderColor: "var(--color-danger)",
                        color: "var(--color-danger)",
                      }}
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                {fs.keywords.length > 1
                  ? "多关键字命中任意一个即可（Enter 触发生成）"
                  : "从页面源码中复制，按 Enter 快速生成"}
              </p>
            </div>

            {/* 关键字类型 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                关键字类型
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(KEYWORD_TYPE_LABELS) as KeywordType[]).map((kt) => {
                  const active = fs.keywordType === kt;
                  return (
                    <button
                      key={kt}
                      onClick={() => patchActive({ keywordType: kt, error: "" })}
                      className="rounded-lg border px-2.5 py-1 text-xs transition-colors"
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
              <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-subtle)" }}>
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
              {fs.generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              {fs.generating
                ? "生成中…"
                : `生成 ${availableTargets.find((t) => t.field === activeField)?.label}`}
            </Button>

            {/* 定位表达式 */}
            {fs.anchorXPath && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <label
                    className="text-xs font-medium"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    定位表达式
                  </label>
                  {!fs.error && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-xs"
                      style={{
                        background: "var(--color-accent-muted)",
                        color: "var(--color-accent)",
                      }}
                    >
                      命中 {fs.anchorCount} 个
                    </span>
                  )}
                  {fs.error && (
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
                      value={fs.anchorXPath}
                      onChange={(e) => patchActive({ anchorXPath: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAdjust(activeField);
                        }
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
                    <RefreshCw className="h-3 w-3" />
                    调整
                  </Button>
                </div>
                {!fs.error && fs.anchorSamples.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                      命中样本（确认是目标元素）：
                    </p>
                    {fs.anchorSamples.slice(0, 3).map((s, i) => (
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
                className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
                style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{fs.error}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col gap-0 overflow-hidden">
          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                XPath 表达式结果
              </p>
              {anyGenerating && (
                <Loader2
                  className="h-3 w-3 animate-spin"
                  style={{ color: "var(--color-accent)" }}
                />
              )}
            </div>

            {availableTargets.map((t) => {
              const f = fields[t.field];
              return (
                <XPathResultRow
                  key={t.field}
                  target={t}
                  html={html}
                  xpath={f.generatedXPath}
                  adopted={f.adopted}
                  isActive={activeField === t.field}
                  generating={f.generating}
                  onActivate={() => setActiveField(t.field)}
                  onToggleAdopt={() => patchField(t.field, { adopted: !f.adopted })}
                  onChange={(val) => patchField(t.field, { generatedXPath: val })}
                />
              );
            })}

            {availableTargets.every((t) => !fields[t.field].generatedXPath) && (
              <XPathQuickGuide page={page} />
            )}
          </div>

          {/* Apply footer */}
          <div
            className="flex shrink-0 items-center gap-2 border-t px-4 py-3"
            style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
          >
            <Button size="sm" onClick={handleApply} disabled={adoptedCount === 0}>
              <ChevronRight className="h-3.5 w-3.5" />
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

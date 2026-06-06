/**
 * XPathResultRow — XPathToolPanel 右侧的单字段结果卡片
 */
import { useState, useEffect } from "react";
import {
  Loader2, Check, AlertCircle, CheckCircle2, XCircle,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { Input } from "@/components/Input";
import { validateGeneratedXPath } from "../xpathTool";
import type { XPathTarget } from "../xpathTool";

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

export function XPathResultRow({
  target, html, xpath, adopted, isActive, generating, onActivate, onToggleAdopt, onChange,
}: ResultRowProps) {
  const [localXPath, setLocalXPath] = useState(xpath);
  const [validation, setValidation] = useState(() =>
    xpath ? validateGeneratedXPath(html, xpath) : null
  );
  const [samplesExpanded, setSamplesExpanded] = useState(false);

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

        {!empty && (
          <button
            className="ml-auto w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all"
            style={{
              background: adopted ? "var(--color-accent)" : "var(--color-surface)",
              borderColor: adopted ? "var(--color-accent)" : "var(--color-border)",
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
              {!samplesExpanded && validation.count > 2 && (
                <button
                  className="text-xs pl-4 text-left hover:opacity-70 transition-opacity"
                  style={{ color: "var(--color-text-subtle)" }}
                  onClick={(e) => { e.stopPropagation(); setSamplesExpanded(true); }}
                >
                  …还有 {validation.count - 2} 条，点击展开
                </button>
              )}
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

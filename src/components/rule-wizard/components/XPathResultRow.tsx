/**
 * XPathResultRow — XPathToolPanel 右侧的单字段结果卡片
 */
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  XCircle,
} from "lucide-react";

import { Input } from "@/components/Input";

import { validateGeneratedXPath, type XPathTarget } from "../xpathTool";

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
  target,
  html,
  xpath,
  adopted,
  isActive,
  generating,
  onActivate,
  onToggleAdopt,
  onChange,
}: ResultRowProps) {
  const [localXPath, setLocalXPath] = useState(xpath);
  const [validation, setValidation] = useState(() =>
    xpath ? validateGeneratedXPath(html, xpath) : null,
  );
  const [samplesExpanded, setSamplesExpanded] = useState(false);
  const canAdopt = !!validation && !validation.error && validation.count > 0;

  useEffect(() => {
    setLocalXPath(xpath);
    setValidation(xpath ? validateGeneratedXPath(html, xpath) : null);
    setSamplesExpanded(false);
  }, [xpath, html]);

  useEffect(() => {
    if (!canAdopt && adopted) onToggleAdopt();
  }, [adopted, canAdopt, onToggleAdopt]);

  const handleBlur = () => {
    if (localXPath !== xpath) onChange(localXPath);
    setValidation(localXPath ? validateGeneratedXPath(html, localXPath) : null);
  };

  const handleChange = (value: string) => {
    setLocalXPath(value);
    onChange(value);
    setValidation(value ? validateGeneratedXPath(html, value) : null);
  };

  const empty = !xpath && !generating;
  const effectiveAdopted = adopted && canAdopt;

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 transition-all"
      style={{
        background: isActive
          ? "color-mix(in srgb, var(--color-accent) 4%, var(--color-surface))"
          : effectiveAdopted
            ? "color-mix(in srgb, var(--color-accent) 5%, var(--color-surface))"
            : "var(--color-surface-2)",
        borderColor: isActive
          ? "var(--color-accent)"
          : effectiveAdopted
            ? "color-mix(in srgb, var(--color-accent) 35%, transparent)"
            : "var(--color-border)",
        opacity: empty ? 0.55 : 1,
      }}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-muted)]"
          onClick={onActivate}
          aria-pressed={isActive}
          aria-label={`选择${target.label} XPath 结果`}
        >
          <span
            className="text-xs font-medium"
            style={{ color: isActive ? "var(--color-accent)" : "var(--color-text)" }}
          >
            {target.label}
          </span>

          {generating && (
            <Loader2 className="h-3 w-3 animate-spin" style={{ color: "var(--color-accent)" }} />
          )}

          {!generating && validation && !validation.error && (
            <span
              className="rounded-full px-1.5 py-0.5 text-xs"
              style={{
                background:
                  validation.count > 0 ? "var(--color-success-bg)" : "var(--color-warning-bg)",
                color: validation.count > 0 ? "var(--color-success)" : "var(--color-warning)",
              }}
            >
              命中 {validation.count}
            </span>
          )}

          {!generating && validation?.error && (
            <span
              className="rounded-full px-1.5 py-0.5 text-xs"
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
        </button>

        {!empty && (
          canAdopt ? (
            <button
              type="button"
              aria-pressed={effectiveAdopted}
              aria-label={effectiveAdopted ? `取消应用${target.label}` : `应用${target.label}`}
              className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all"
              style={{
                background: effectiveAdopted ? "var(--color-accent)" : "var(--color-surface)",
                borderColor: effectiveAdopted ? "var(--color-accent)" : "var(--color-border)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleAdopt();
              }}
              title={effectiveAdopted ? "取消应用此字段" : "应用此字段"}
            >
              {effectiveAdopted && <Check className="h-3 w-3" style={{ color: "#fff" }} />}
            </button>
          ) : (
            <span
              className="ml-auto rounded px-1.5 py-0.5 text-xs"
              style={{
                background: validation?.error
                  ? "var(--color-danger-bg)"
                  : "var(--color-warning-bg)",
                color: validation?.error ? "var(--color-danger)" : "var(--color-warning)",
              }}
              title={
                validation?.error
                  ? "XPath 语法错误，不能应用"
                  : "XPath 命中数为 0，不能应用"
              }
            >
              不可应用
            </span>
          )
        )}
      </div>

      {!empty && !generating && (
        <div onClick={(e) => e.stopPropagation()}>
          <Input
            value={localXPath}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder="可手动输入或粘贴 XPath"
            style={{ fontFamily: "monospace", fontSize: 11 }}
          />
        </div>
      )}

      {generating && (
        <div className="h-7 animate-pulse rounded" style={{ background: "var(--color-border)" }} />
      )}

      {!generating && validation && (
        <div className="flex flex-col gap-0.5 pl-1">
          {validation.error ? (
            <div
              className="flex items-center gap-1 text-xs"
              style={{ color: "var(--color-danger)" }}
            >
              <XCircle className="h-3 w-3 shrink-0" />
              <span className="truncate">{validation.error}</span>
            </div>
          ) : validation.count === 0 ? (
            <div
              className="flex items-center gap-1 text-xs"
              style={{ color: "var(--color-warning)" }}
            >
              <AlertCircle className="h-3 w-3 shrink-0" />
              未命中任何节点，当前字段不能勾选或应用
            </div>
          ) : (
            <>
              <button
                type="button"
                className="-mx-0.5 flex w-fit items-center gap-1 rounded px-0.5 text-xs transition-opacity hover:opacity-70"
                style={{ color: "var(--color-success)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSamplesExpanded((value) => !value);
                }}
                title={samplesExpanded ? "收起命中列表" : "展开查看全部命中"}
              >
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                命中 {validation.count} 个
                {validation.count > 2 &&
                  (samplesExpanded ? (
                    <ChevronUp className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  ))}
              </button>
              {(samplesExpanded ? validation.samples : validation.samples.slice(0, 2)).map(
                (sample, index) => (
                  <span
                    key={index}
                    className="truncate pl-4 text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                    title={sample}
                  >
                    {index + 1}. {sample}
                  </span>
                ),
              )}
              {!samplesExpanded && validation.count > 2 && (
                <button
                  type="button"
                  className="pl-4 text-left text-xs transition-opacity hover:opacity-70"
                  style={{ color: "var(--color-text-subtle)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSamplesExpanded(true);
                  }}
                >
                  …还有 {validation.count - 2} 条，点击展开
                </button>
              )}
              {samplesExpanded && validation.count > 2 && (
                <button
                  type="button"
                  className="pl-4 text-left text-xs transition-opacity hover:opacity-70"
                  style={{ color: "var(--color-text-subtle)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSamplesExpanded(false);
                  }}
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

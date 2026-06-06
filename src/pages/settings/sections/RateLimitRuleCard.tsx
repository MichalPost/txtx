import { ChevronDown, ChevronUp, ShieldCheck, Trash2 } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { Input } from "@/components/Input";

import { FieldError } from "../SettingsFields";
import type { SettingsForm } from "../settingsSchema";

interface RateLimitRuleCardProps {
  index: number;
  fieldId: string;
  isOpen: boolean;
  onToggle: () => void;
  onRemove: () => void;
  errors?: Record<string, { message?: string }>;
}

export function RateLimitRuleCard({
  index,
  isOpen,
  onToggle,
  onRemove,
  errors: errs,
}: RateLimitRuleCardProps) {
  const { register, watch } = useFormContext<SettingsForm>();
  const ruleName = watch(`rate_limit_rules.${index}.name`) as string | undefined;
  const ruleDomains = watch(`rate_limit_rules.${index}.domains`) as string | undefined;

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* Header */}
      <div
        className="flex cursor-pointer items-center gap-2 px-3 py-2 select-none"
        style={{ background: "var(--color-surface-1)" }}
        onClick={onToggle}
      >
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
        <span className="flex-1 truncate text-xs font-medium" style={{ color: "var(--color-text)" }}>
          {ruleName || `规则 ${index + 1}`}
        </span>
        <span className="max-w-48 truncate text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {ruleDomains
            ? ruleDomains.split("\n").filter(Boolean).slice(0, 3).join(", ")
            : "（无域名）"}
        </span>
        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="shrink-0 rounded-md p-1 hover:opacity-70"
          style={{ color: "var(--color-danger)" }}
          title="删除规则"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expanded body */}
      {isOpen && (
        <div
          className="flex flex-col gap-3 border-t p-3"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              规则名称
            </label>
            <input
              {...register(`rate_limit_rules.${index}.name`)}
              className="w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              placeholder="如：TTKS 系站点"
            />
            <FieldError msg={errs?.name?.message} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              匹配域名（每行一条，URL 包含任意一条即命中）
            </label>
            <textarea
              {...register(`rate_limit_rules.${index}.domains`)}
              rows={3}
              className="w-full resize-y rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              placeholder={"ttks.tw\nttks.cc\nttks.me"}
            />
            <FieldError msg={errs?.domains?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="最小延迟（毫秒）"
                type="number"
                {...register(`rate_limit_rules.${index}.delay_min_ms`)}
              />
              <FieldError msg={errs?.delay_min_ms?.message} />
            </div>
            <div>
              <Input
                label="最大延迟（毫秒）"
                type="number"
                {...register(`rate_limit_rules.${index}.delay_max_ms`)}
              />
              <FieldError msg={errs?.delay_max_ms?.message} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Input
              label="每秒最大请求数（0 = 使用随机延迟）"
              type="number"
              {...register(`rate_limit_rules.${index}.requests_per_second`)}
            />
            <FieldError msg={errs?.requests_per_second?.message} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              User-Agent 池（每行一条，随机轮换；空 = 使用全局 UA）
            </label>
            <textarea
              {...register(`rate_limit_rules.${index}.ua_pool`)}
              rows={4}
              className="w-full resize-y rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."
            />
            <FieldError msg={errs?.ua_pool?.message} />
          </div>

          <label
            className="flex cursor-pointer items-center gap-2 text-xs"
            style={{ color: "var(--color-text)" }}
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-(--color-accent)"
              {...register(`rate_limit_rules.${index}.stealth`)}
            />
            <span>启用 Stealth TLS 指纹（绕过 JA3/JA4 反爬，需 stealth feature 编译）</span>
          </label>
        </div>
      )}
    </div>
  );
}

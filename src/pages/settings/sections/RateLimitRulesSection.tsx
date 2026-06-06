import { useFieldArray, useFormContext } from "react-hook-form";
import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { FieldError } from "../SettingsFields";
import type { SettingsForm } from "../settingsSchema";

const DEFAULT_RULE = {
  name: "新规则",
  domains: "",
  delay_min_ms: 1000,
  delay_max_ms: 3000,
  requests_per_second: 0,
  ua_pool: "",
  stealth: true,
};

export function RateLimitRulesSection() {
  const { control, register, watch, formState: { errors } } = useFormContext<SettingsForm>();
  const { fields, append, remove } = useFieldArray({ control, name: "rate_limit_rules" });
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (i: number) =>
    setExpanded(prev => ({ ...prev, [i]: !prev[i] }));

  const rulesErrors = errors.rate_limit_rules as Array<Record<string, { message?: string }> | undefined> | undefined;

  return (
    <Card title="请求限速规则">
      <div className="flex flex-col gap-3">
        <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          为任意站点配置独立的反爬限速策略（延迟、UA 轮换、TLS 指纹）。URL 命中第一条匹配规则即应用。
        </p>

        {fields.length === 0 && (
          <p className="text-xs text-center py-3" style={{ color: "var(--color-text-subtle)" }}>
            暂无规则，点击下方按钮添加
          </p>
        )}

        {fields.map((field, i) => {
          const isOpen = !!expanded[i];
          const errs = rulesErrors?.[i];
          // Watch name field for header display
          const ruleName = watch(`rate_limit_rules.${i}.name`);
          const ruleDomains = watch(`rate_limit_rules.${i}.domains`);
          return (
            <div
              key={field.id}
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: "var(--color-border)" }}
            >
              {/* Header row */}
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
                style={{ background: "var(--color-surface-1)" }}
                onClick={() => toggle(i)}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
                <span className="flex-1 text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>
                  {ruleName || `规则 ${i + 1}`}
                </span>
                <span className="text-xs truncate max-w-48" style={{ color: "var(--color-text-subtle)" }}>
                  {ruleDomains
                    ? ruleDomains.split("\n").filter(Boolean).slice(0, 3).join(", ")
                    : "（无域名）"}
                </span>
                {isOpen
                  ? <ChevronUp className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                  : <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                }
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(i); }}
                  className="p-1 rounded-md hover:opacity-70 shrink-0"
                  style={{ color: "var(--color-danger)" }}
                  title="删除规则"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Expanded body */}
              {isOpen && (
                <div
                  className="flex flex-col gap-3 p-3 border-t"
                  style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                >
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>规则名称</label>
                    <input
                      {...register(`rate_limit_rules.${i}.name`)}
                      className="w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                      style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                      placeholder="如：TTKS 系站点"
                    />
                    <FieldError msg={errs?.name?.message} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                      匹配域名（每行一条，URL 包含任意一条即命中）
                    </label>
                    <textarea
                      {...register(`rate_limit_rules.${i}.domains`)}
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none resize-y"
                      style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                      placeholder={"ttks.tw\nttks.cc\nttks.me"}
                    />
                    <FieldError msg={errs?.domains?.message} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Input
                        label="最小延迟（毫秒）"
                        type="number"
                        {...register(`rate_limit_rules.${i}.delay_min_ms`)}
                      />
                      <FieldError msg={errs?.delay_min_ms?.message} />
                    </div>
                    <div>
                      <Input
                        label="最大延迟（毫秒）"
                        type="number"
                        {...register(`rate_limit_rules.${i}.delay_max_ms`)}
                      />
                      <FieldError msg={errs?.delay_max_ms?.message} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Input
                      label="每秒最大请求数（0 = 使用随机延迟）"
                      type="number"
                      {...register(`rate_limit_rules.${i}.requests_per_second`)}
                    />
                    <FieldError msg={errs?.requests_per_second?.message} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                      User-Agent 池（每行一条，随机轮换；空 = 使用全局 UA）
                    </label>
                    <textarea
                      {...register(`rate_limit_rules.${i}.ua_pool`)}
                      rows={4}
                      className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none resize-y"
                      style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                      placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."
                    />
                    <FieldError msg={errs?.ua_pool?.message} />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: "var(--color-text)" }}>
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 accent-[var(--color-accent)]"
                      {...register(`rate_limit_rules.${i}.stealth`)}
                    />
                    <span>启用 Stealth TLS 指纹（绕过 JA3/JA4 反爬，需 stealth feature 编译）</span>
                  </label>
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            const newIndex = fields.length;
            append(DEFAULT_RULE);
            // Auto-expand the new rule
            setExpanded(prev => ({ ...prev, [newIndex]: true }));
          }}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-dashed text-xs transition-colors"
          style={{
            borderColor: "var(--color-border-hover)",
            color: "var(--color-text-muted)",
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          添加限速规则
        </button>
      </div>
    </Card>
  );
}

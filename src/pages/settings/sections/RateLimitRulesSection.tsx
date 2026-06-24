import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { Card } from "@/components/Card";

import type { SettingsForm } from "../settingsSchema";
import { RateLimitRuleCard } from "./RateLimitRuleCard";

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
  const {
    control,
    formState: { errors },
  } = useFormContext<SettingsForm>();
  const { fields, append, remove } = useFieldArray({ control, name: "rate_limit_rules" });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const knownFieldIdsRef = useRef(new Set(fields.map((field) => field.id)));

  const toggle = (fieldId: string) =>
    setExpanded((prev) => ({ ...prev, [fieldId]: !prev[fieldId] }));

  useEffect(() => {
    const known = knownFieldIdsRef.current;
    const newField = fields.find((field) => !known.has(field.id));
    knownFieldIdsRef.current = new Set(fields.map((field) => field.id));
    if (newField) {
      setExpanded((prev) => ({ ...prev, [newField.id]: true }));
    }
  }, [fields]);

  const rulesErrors = errors.rate_limit_rules as
    | Array<Record<string, { message?: string }> | undefined>
    | undefined;

  return (
    <Card title="请求限速规则">
      <div className="flex flex-col gap-3">
        <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          为任意站点配置独立的反爬限速策略（延迟、UA 轮换、TLS 指纹）。URL
          命中第一条匹配规则即应用。
        </p>

        {fields.length === 0 && (
          <p className="py-3 text-center text-xs" style={{ color: "var(--color-text-subtle)" }}>
            暂无规则，点击下方按钮添加
          </p>
        )}

        {fields.map((field, i) => (
          <RateLimitRuleCard
            key={field.id}
            index={i}
            fieldId={field.id}
            isOpen={!!expanded[field.id]}
            onToggle={() => toggle(field.id)}
            onRemove={() => remove(i)}
            errors={rulesErrors?.[i]}
          />
        ))}

        <button
          type="button"
          onClick={() => {
            append(DEFAULT_RULE);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-2 text-xs transition-colors"
          style={{
            borderColor: "var(--color-border-hover)",
            color: "var(--color-text-muted)",
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          添加限速规则
        </button>
      </div>
    </Card>
  );
}

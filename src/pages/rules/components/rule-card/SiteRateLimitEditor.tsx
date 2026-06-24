import { useCallback, useState } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";

import { useConfirmDialog } from "@/components/ConfirmDialog";
import { parseBoundedIntegerInput } from "@/lib/numberInput";
import { useConfigStore } from "@/store/configStore";
import type { RateLimitRule } from "@/types";

function arrToText(arr: string[]): string {
  return arr.join("\n");
}

function textToArr(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trimEnd())
    .filter(Boolean);
}

const EMPTY_RULE = (domain: string): RateLimitRule => ({
  name: domain ? `${domain} 限速规则` : "新限速规则",
  domains: domain ? [domain] : [],
  delay_min_ms: 1000,
  delay_max_ms: 3000,
  requests_per_second: 0,
  ua_pool: [],
  stealth: true,
});

export function SiteRateLimitEditor({ displayDomain }: { displayDomain: string }) {
  const { config, saveConfig, saving } = useConfigStore();
  const [deletePending, setDeletePending] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  // Extract the matching rule index (by domain substring match) and the rule itself.
  const allRules = config?.rate_limit?.rules ?? [];
  const matchIndex = allRules.findIndex((r) =>
    r.domains.some((d) => displayDomain.includes(d) || d.includes(displayDomain)),
  );
  const hasRule = matchIndex >= 0;

  // Local draft state — initialised from store on first render / when matchIndex changes
  const [draft, setDraft] = useState<RateLimitRule>(() =>
    hasRule ? { ...allRules[matchIndex] } : EMPTY_RULE(displayDomain),
  );

  // When the matched rule in the store changes externally, sync the draft
  const storeRule = hasRule ? allRules[matchIndex] : null;
  const storeRuleKey = storeRule ? JSON.stringify(storeRule) : null;
  const [lastKey, setLastKey] = useState(storeRuleKey);
  if (storeRuleKey !== lastKey) {
    setLastKey(storeRuleKey);
    setDraft(storeRule ? { ...storeRule } : EMPTY_RULE(displayDomain));
  }

  const set = useCallback(
    <K extends keyof RateLimitRule>(key: K, value: RateLimitRule[K]) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const handleSave = async () => {
    if (!config) return;
    const updated = [...allRules];
    if (hasRule) {
      updated[matchIndex] = draft;
    } else {
      updated.push(draft);
    }
    await saveConfig({ ...config, rate_limit: { rules: updated } });
  };

  const handleDelete = async () => {
    if (!config || !hasRule || deletePending) return;
    setDeletePending(true);
    const confirmed = await confirm({
      title: `删除「${draft.name}」限速规则？`,
      description: "删除后此站点会回到全局限速策略，当前限速规则无法自动恢复。",
      confirmLabel: "删除限速规则",
      tone: "danger",
    }).catch(() => false);
    if (!confirmed) {
      setDeletePending(false);
      return;
    }
    const updated = allRules.filter((_, i) => i !== matchIndex);
    try {
      await saveConfig({ ...config, rate_limit: { rules: updated } });
      setDraft(EMPTY_RULE(displayDomain));
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Status strip */}
      <div className="flex items-center gap-2">
        <ShieldCheck
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: hasRule ? "var(--color-accent)" : "var(--color-text-subtle)" }}
        />
        <span className="flex-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          {hasRule ? `已关联限速规则：${draft.name}` : "此站点暂无限速规则，填写后保存即可创建"}
        </span>
        {hasRule && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deletePending}
            className="rounded-md p-1 text-xs hover:opacity-70"
            style={{ color: "var(--color-danger)" }}
            title={deletePending ? "等待确认" : "删除此限速规则"}
            aria-label={deletePending ? "等待确认删除限速规则" : "删除此限速规则"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Rule name */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="rate-limit-name"
          className="w-16 shrink-0 text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          规则名称
        </label>
        <input
          id="rate-limit-name"
          name="rate-limit-name"
          className="flex-1 rounded-lg border px-2 py-1 text-xs focus:outline-none"
          style={{
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
          }}
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </div>

      {/* Domains */}
      <div className="flex flex-col gap-1">
        <label htmlFor="rate-limit-domains" className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          匹配域名（每行一条，URL 包含任意一条即命中）
        </label>
        <textarea
          id="rate-limit-domains"
          name="rate-limit-domains"
          rows={2}
          className="w-full resize-y rounded-lg border px-2 py-1.5 font-mono text-xs focus:outline-none"
          style={{
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
          }}
          value={arrToText(draft.domains)}
          onChange={(e) => set("domains", textToArr(e.target.value))}
        />
      </div>

      {/* Delay range */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="rate-limit-delay-min-ms"
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            最小延迟（ms）
          </label>
          <input
            id="rate-limit-delay-min-ms"
            name="rate-limit-delay-min-ms"
            type="number"
            min={0}
            className="w-full rounded-lg border px-2 py-1 text-xs focus:outline-none"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
            value={draft.delay_min_ms}
            onChange={(e) =>
              set("delay_min_ms", parseBoundedIntegerInput(e.target.value, draft.delay_min_ms, { min: 0 }))
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="rate-limit-delay-max-ms"
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            最大延迟（ms）
          </label>
          <input
            id="rate-limit-delay-max-ms"
            name="rate-limit-delay-max-ms"
            type="number"
            min={0}
            className="w-full rounded-lg border px-2 py-1 text-xs focus:outline-none"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
            value={draft.delay_max_ms}
            onChange={(e) =>
              set("delay_max_ms", parseBoundedIntegerInput(e.target.value, draft.delay_max_ms, { min: 0 }))
            }
          />
        </div>
      </div>

      {/* RPS */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="rate-limit-requests-per-second"
          className="w-16 shrink-0 text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          每秒请求数
        </label>
        <input
          id="rate-limit-requests-per-second"
          name="rate-limit-requests-per-second"
          type="number"
          min={0}
          className="w-24 rounded-lg border px-2 py-1 text-xs focus:outline-none"
          style={{
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
          }}
          value={draft.requests_per_second}
          onChange={(e) =>
            set(
              "requests_per_second",
              parseBoundedIntegerInput(e.target.value, draft.requests_per_second, { min: 0 }),
            )
          }
        />
        <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          0 = 使用随机延迟
        </span>
      </div>

      {/* UA pool */}
      <div className="flex flex-col gap-1">
        <label htmlFor="rate-limit-ua-pool" className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          User-Agent 池（每行一条；空 = 使用全局 UA）
        </label>
        <textarea
          id="rate-limit-ua-pool"
          name="rate-limit-ua-pool"
          rows={3}
          className="w-full resize-y rounded-lg border px-2 py-1.5 font-mono text-xs focus:outline-none"
          style={{
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
          }}
          placeholder="Mozilla/5.0 ..."
          value={arrToText(draft.ua_pool)}
          onChange={(e) => set("ua_pool", textToArr(e.target.value))}
        />
      </div>

      {/* Stealth */}
      <label
        className="flex cursor-pointer items-center gap-2 text-xs"
        style={{ color: "var(--color-text)" }}
      >
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-[var(--color-accent)]"
          checked={draft.stealth}
          onChange={(e) => set("stealth", e.target.checked)}
        />
        <span>启用 Stealth TLS 指纹（绕过 JA3/JA4 反爬）</span>
      </label>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {saving ? "保存中…" : hasRule ? "更新限速规则" : "创建限速规则"}
        </button>
      </div>
      {confirmDialog}
    </div>
  );
}

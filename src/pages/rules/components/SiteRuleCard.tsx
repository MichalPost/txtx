import { useCallback, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Code2,
  Copy,
  Edit3,
  Globe,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Wand2,
} from "lucide-react";

import { AiXPathAnalyzer } from "@/components/AiXPathAnalyzer";
import { RuleTemplateSelector } from "@/components/RuleTemplateSelector";
import { SourceViewer } from "@/components/SourceViewer";
import { loadRuleHealth } from "@/lib/ruleHealth";
import { useAiStore } from "@/store/aiStore";
import { useConfigStore } from "@/store/configStore";
import type { RateLimitRule, WebsiteConfig } from "@/types";

// ─── Micro-components ─────────────────────────────────────────────────────────

function ActionButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
      style={{
        background: hov
          ? "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))"
          : "transparent",
        color: hov ? "var(--color-accent)" : "var(--color-text-muted)",
        border: "1px solid",
        borderColor: hov
          ? "color-mix(in srgb, var(--color-accent) 35%, transparent)"
          : "transparent",
        transform: hov ? "translateY(-0.5px)" : "none",
        transition: "all 120ms ease",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {children}
    </button>
  );
}

function IconButton({
  onClick,
  title,
  color,
  hoverBg,
  children,
}: {
  onClick: () => void;
  title: string;
  color: string;
  hoverBg?: string;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-lg transition-all"
      style={{
        color,
        background: hov && hoverBg ? hoverBg : hov ? "var(--color-surface-2)" : "transparent",
        opacity: hov ? 1 : 0.7,
        transform: hov ? "translateY(-0.5px)" : "none",
        transition: "all 120ms ease",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {children}
    </button>
  );
}

function ToolBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all"
      style={{
        background: active
          ? "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))"
          : "var(--color-surface-2)",
        borderColor: active
          ? "color-mix(in srgb, var(--color-accent) 45%, transparent)"
          : "var(--color-border)",
        color: active ? "var(--color-accent)" : "var(--color-text-muted)",
        fontWeight: active ? 600 : 400,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── SiteRateLimitEditor ──────────────────────────────────────────────────────
// Inline editor for rate-limit rules scoped to a single site domain.
// Reads/writes config.rate_limit.rules directly via configStore.

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

function SiteRateLimitEditor({ displayDomain }: { displayDomain: string }) {
  const { config, saveConfig, saving } = useConfigStore();

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

  const handleSave = () => {
    if (!config) return;
    const updated = [...allRules];
    if (hasRule) {
      updated[matchIndex] = draft;
    } else {
      updated.push(draft);
    }
    saveConfig({ ...config, rate_limit: { rules: updated } });
  };

  const handleDelete = () => {
    if (!config || !hasRule) return;
    if (!confirm(`确认删除「${draft.name}」限速规则？`)) return;
    const updated = allRules.filter((_, i) => i !== matchIndex);
    saveConfig({ ...config, rate_limit: { rules: updated } });
    setDraft(EMPTY_RULE(displayDomain));
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
            onClick={handleDelete}
            className="rounded-md p-1 text-xs hover:opacity-70"
            style={{ color: "var(--color-danger)" }}
            title="删除此限速规则"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Rule name */}
      <div className="flex items-center gap-2">
        <label className="w-16 shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
          规则名称
        </label>
        <input
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
        <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          匹配域名（每行一条，URL 包含任意一条即命中）
        </label>
        <textarea
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
          <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            最小延迟（ms）
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded-lg border px-2 py-1 text-xs focus:outline-none"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
            value={draft.delay_min_ms}
            onChange={(e) => set("delay_min_ms", Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            最大延迟（ms）
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded-lg border px-2 py-1 text-xs focus:outline-none"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
            value={draft.delay_max_ms}
            onChange={(e) => set("delay_max_ms", Number(e.target.value))}
          />
        </div>
      </div>

      {/* RPS */}
      <div className="flex items-center gap-2">
        <label className="w-16 shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
          每秒请求数
        </label>
        <input
          type="number"
          min={0}
          className="w-24 rounded-lg border px-2 py-1 text-xs focus:outline-none"
          style={{
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
          }}
          value={draft.requests_per_second}
          onChange={(e) => set("requests_per_second", Number(e.target.value))}
        />
        <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          0 = 使用随机延迟
        </span>
      </div>

      {/* UA pool */}
      <div className="flex flex-col gap-1">
        <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          User-Agent 池（每行一条；空 = 使用全局 UA）
        </label>
        <textarea
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
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {saving ? "保存中…" : hasRule ? "更新限速规则" : "创建限速规则"}
        </button>
      </div>
    </div>
  );
}

// ─── SiteRuleCard ──────────────────────────────────────────────────────────────

interface CardStatus {
  filled: number;
  total: number;
  complete: boolean;
}

export function SiteRuleCard({
  siteKey,
  site,
  status,
  onEdit,
  onToggle,
  onDelete,
  highlighted,
  onQuickSave,
  onDuplicate,
  dragHandle,
}: {
  siteKey: string;
  site: WebsiteConfig;
  status: CardStatus;
  highlighted?: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onQuickSave: (patch: Partial<WebsiteConfig>) => void;
  onDuplicate: () => void;
  dragHandle?: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draftDomain, setDraftDomain] = useState(site.domain_name);
  const [draftReleaseUrl, setDraftReleaseUrl] = useState(site.release_url);
  const [activePanel, setActivePanel] = useState<"template" | "ai" | "source" | "ratelimit" | null>(null);

  const aiEnabled = useAiStore((s) => s.config.enabled);

  const isEnabled = site.enabled;

  // Clean domain display: strip protocol, trailing slash
  const displayDomain =
    site.domain_name.replace(/^https?:\/\//, "").replace(/\/$/, "") || site.domain_name;
  const health = loadRuleHealth()[displayDomain];

  return (
    <div
      data-row
      className="flex flex-col rounded-xl border px-4 py-3 transition-all"
      style={{
        background: isEnabled ? "var(--color-surface)" : "var(--color-surface-1)",
        borderColor: highlighted
          ? "color-mix(in srgb, var(--color-accent) 48%, transparent)"
          : hovered
            ? "var(--color-border-hover)"
            : "var(--color-border)",
        boxShadow: highlighted
          ? "var(--shadow-accent)"
          : hovered
            ? "var(--shadow-md)"
            : "var(--shadow-sm)",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        transition:
          "border-color 120ms ease, box-shadow 150ms ease, transform 150ms ease, background 150ms ease",
        // Start invisible — stagger animation sets opacity to 1
        opacity: 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main row */}
      <div className="flex items-center gap-3">
        {/* Drag handle (if provided) */}
        {dragHandle && (
          <span
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 cursor-grab active:cursor-grabbing"
            style={{ color: "var(--color-text-subtle)" }}
          >
            {dragHandle}
          </span>
        )}

        {/* Globe icon — tinted when enabled */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
          style={{
            background: isEnabled
              ? "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface-1))"
              : "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
          }}
        >
          <Globe
            className="h-4 w-4 transition-colors"
            style={{ color: isEnabled ? "var(--color-accent)" : "var(--color-text-subtle)" }}
          />
        </div>

        {/* Info block */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Domain + key */}
          <div className="flex min-w-0 items-baseline gap-2">
            <span
              className="truncate text-sm font-medium"
              style={{ color: "var(--color-text)" }}
              title={site.domain_name}
            >
              {displayDomain}
            </span>
            <span
              className="shrink-0 font-mono text-xs"
              style={{
                color: "var(--color-text-subtle)",
                fontSize: "10px",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: "4px",
                padding: "1px 5px",
              }}
            >
              {siteKey}
            </span>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-1.5">
            {status.complete ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: "var(--color-success-bg)",
                  color: "var(--color-success)",
                  fontSize: "11px",
                }}
              >
                <CheckCircle2 className="h-2.5 w-2.5" />
                规则完整
              </span>
            ) : (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: "var(--color-warning-bg)",
                  color: "var(--color-warning)",
                  fontSize: "11px",
                }}
              >
                {status.filled}/{status.total} 项已填
              </span>
            )}

            {site.special_mode === "ttks" && (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: "var(--color-accent-muted)",
                  color: "var(--color-accent)",
                  fontSize: "11px",
                }}
              >
                TTKS
              </span>
            )}

            {!isEnabled && (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: "var(--color-surface-2)",
                  color: "var(--color-text-subtle)",
                  fontSize: "11px",
                  border: "1px solid var(--color-border)",
                }}
              >
                已停用
              </span>
            )}

            {highlighted && (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: "var(--color-accent-muted)",
                  color: "var(--color-accent)",
                  fontSize: "11px",
                }}
              >
                刚保存
              </span>
            )}

            {site.encoding?.trim() && (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: "var(--color-surface-2)",
                  color: "var(--color-text-muted)",
                  fontSize: "11px",
                  border: "1px solid var(--color-border)",
                }}
              >
                {site.encoding}
              </span>
            )}

            {health && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                style={{
                  background:
                    health.lastStatus === "success"
                      ? "var(--color-success-bg)"
                      : "var(--color-danger-bg)",
                  color:
                    health.lastStatus === "success"
                      ? "var(--color-success)"
                      : "var(--color-danger)",
                  fontSize: "11px",
                }}
                title={`上次使用: ${new Date(health.lastUsed).toLocaleString("zh-CN")}\n成功 ${health.successCount} 次，失败 ${health.errorCount} 次${health.lastError ? `\n错误: ${health.lastError}` : ""}`}
              >
                <Activity className="h-2.5 w-2.5" />
                {health.lastStatus === "success" ? "上次成功" : "上次失败"}
              </span>
            )}

            {site.page_list.length > 1 && (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: "var(--color-surface-2)",
                  color: "var(--color-text-muted)",
                  fontSize: "11px",
                  border: "1px solid var(--color-border)",
                }}
              >
                {site.page_list.length} 页
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-0.5">
          {/* Edit */}
          <ActionButton onClick={onEdit} title="用向导编辑规则">
            <Edit3 className="h-3.5 w-3.5" />
            <span className="text-xs">编辑</span>
            <ChevronRight className="h-3 w-3 opacity-60" />
          </ActionButton>

          {/* Duplicate */}
          <IconButton onClick={onDuplicate} title="复制此站点规则" color="var(--color-text-muted)">
            <Copy className="h-3.5 w-3.5" />
          </IconButton>

          {/* Quick expand */}
          <IconButton
            onClick={() => {
              if (expanded) setActivePanel(null);
              setExpanded((v) => !v);
              setDraftDomain(site.domain_name);
              setDraftReleaseUrl(site.release_url);
            }}
            title={expanded ? "收起快速编辑" : "展开快速编辑"}
            color="var(--color-text-subtle)"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </IconButton>

          {/* Toggle */}
          <IconButton
            onClick={onToggle}
            title={isEnabled ? "停用此站点" : "启用此站点"}
            color={isEnabled ? "var(--color-success)" : "var(--color-text-subtle)"}
          >
            {isEnabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
          </IconButton>

          {/* Delete */}
          <IconButton
            onClick={onDelete}
            title="删除此站点规则"
            color="var(--color-danger)"
            hoverBg="var(--color-danger-bg)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      {/* Expanded quick-edit panel */}
      {expanded && (
        <div
          className="mt-3 flex flex-col gap-2 border-t pt-3"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <label className="w-14 shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
              域名
            </label>
            <input
              className="flex-1 rounded-lg border px-2 py-1 text-xs"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
                outline: "none",
              }}
              value={draftDomain}
              onChange={(e) => setDraftDomain(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-14 shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
              更新页
            </label>
            <input
              className="flex-1 rounded-lg border px-2 py-1 text-xs"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
                outline: "none",
              }}
              value={draftReleaseUrl}
              onChange={(e) => setDraftReleaseUrl(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setExpanded(false);
                setActivePanel(null);
                setDraftDomain(site.domain_name);
                setDraftReleaseUrl(site.release_url);
              }}
              className="rounded-lg border px-3 py-1 text-xs transition-colors"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
                background: "transparent",
              }}
            >
              取消
            </button>
            <button
              onClick={() => {
                onQuickSave({
                  domain_name: draftDomain.trim() || site.domain_name,
                  release_url: draftReleaseUrl.trim(),
                });
                setExpanded(false);
                setActivePanel(null);
              }}
              className="rounded-lg px-3 py-1 text-xs"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              保存
            </button>
          </div>

          {/* Advanced tools toolbar */}
          <div
            className="mt-2 flex flex-wrap gap-1.5 border-t pt-2"
            style={{ borderColor: "var(--color-border)" }}
          >
            <ToolBtn
              active={activePanel === "ratelimit"}
              onClick={() => setActivePanel((p) => (p === "ratelimit" ? null : "ratelimit"))}
              icon={<ShieldCheck className="h-3 w-3" />}
              label="限速规则"
            />
            <ToolBtn
              active={activePanel === "template"}
              onClick={() => setActivePanel((p) => (p === "template" ? null : "template"))}
              icon={<Wand2 className="h-3 w-3" />}
              label="规则模板"
            />
            {aiEnabled && (
              <ToolBtn
                active={activePanel === "ai"}
                onClick={() => setActivePanel((p) => (p === "ai" ? null : "ai"))}
                icon={<Sparkles className="h-3 w-3" />}
                label="AI 分析"
              />
            )}
            <ToolBtn
              active={activePanel === "source"}
              onClick={() => setActivePanel((p) => (p === "source" ? null : "source"))}
              icon={<Code2 className="h-3 w-3" />}
              label="源码查看器"
            />
          </div>

          {/* Panel content */}
          {activePanel === "ratelimit" && (
            <div
              className="mt-2 rounded-xl border p-3"
              style={{
                background: "var(--color-surface-1)",
                borderColor: "var(--color-border)",
              }}
            >
              <SiteRateLimitEditor displayDomain={displayDomain} />
            </div>
          )}
          {activePanel === "template" && (
            <div className="mt-2">
              <RuleTemplateSelector
                onApply={(patch) => {
                  onQuickSave(patch);
                  setActivePanel(null);
                }}
                onClose={() => setActivePanel(null)}
              />
            </div>
          )}
          {activePanel === "ai" && (
            <div className="mt-2">
              <AiXPathAnalyzer
                site={site}
                onApply={(patch) => {
                  onQuickSave(patch);
                  setActivePanel(null);
                }}
                onClose={() => setActivePanel(null)}
              />
            </div>
          )}
          {activePanel === "source" && (
            <div className="mt-2">
              <SourceViewer
                defaultUrl={site.domain_name}
                onXPathSelect={(xpath, field) =>
                  onQuickSave({ [field as keyof WebsiteConfig]: xpath } as Partial<WebsiteConfig>)
                }
                onClose={() => setActivePanel(null)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

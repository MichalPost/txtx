/**
 * RulesPage — 规则管理页面
 *
 * 两种操作入口：
 * - 向导模式：引导普通用户一步步配置规则
 * - 列表模式：快速浏览和编辑已有站点规则
 */
import { useState, useEffect, useRef } from "react";
import {
  Plus, Wand2, Globe, ChevronRight, Trash2,
  ToggleLeft, ToggleRight, Edit3, CheckCircle2, ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useConfigStore } from "@/store/configStore";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { RuleWizard } from "@/components/rule-wizard/RuleWizard";
import { animateFadeInUp, animateStagger } from "@/lib/animations";
import type { WebsiteConfig } from "@/types";

// ─── Default for new sites ─────────────────────────────────────────────────────

const DEFAULT_SITE: WebsiteConfig = {
  enabled: true,
  domain_name: "https://",
  release_date: "",
  release_url: "",
  list_novel_name: "",
  novel_content: "",
  novel_name_x: "",
  chapter_url_x: "",
  page_list: ["/tongren"],
  special_mode: "normal",
  novel_content_fallbacks: [],
  encoding: "",
};

function generateSiteKey(existingKeys: string[]): string {
  let index = existingKeys.length + 1;
  let key = `web${index}`;
  while (existingKeys.includes(key)) {
    index += 1;
    key = `web${index}`;
  }
  return key;
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function RulesPage() {
  const { config, saveConfig, saving } = useConfigStore();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [recentlySavedKey, setRecentlySavedKey] = useState<string | null>(null);

  if (!config) {
    return (
      <div className="p-5 text-sm" style={{ color: "var(--color-text-muted)" }}>
        正在加载...
      </div>
    );
  }

  const websites = config.websites;
  const siteKeys = Object.keys(websites);

  const handleNewSite = () => {
    const key = generateSiteKey(siteKeys);
    setEditingKey(key);
  };

  const handleWizardApply = (key: string, patch: Partial<WebsiteConfig>) => {
    const base = websites[key] ?? { ...DEFAULT_SITE };
    const updatedSite: WebsiteConfig = { ...base, ...patch };
    let hostname = "";

    // Sync encoding to network.encoding_map
    // Extract the hostname from domain_name to use as the map key
    const encodingMap = { ...(config.network.encoding_map ?? {}) };
    try {
      hostname = new URL(updatedSite.domain_name).hostname;
    } catch {
      hostname = updatedSite.domain_name.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }

    const duplicateKey = Object.entries(websites).find(([siteKey, site]) => {
      if (siteKey === key) return false;
      const siteHostname = (() => {
        try {
          return new URL(site.domain_name).hostname;
        } catch {
          return site.domain_name.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        }
      })();
      return hostname && siteHostname && siteHostname === hostname;
    })?.[0];

    if (duplicateKey) {
      toast.error(`已存在相同域名规则：${duplicateKey}`);
      return;
    }

    if (hostname) {
      if (updatedSite.encoding?.trim()) {
        encodingMap[hostname] = updatedSite.encoding.trim();
      } else {
        // Remove the entry if encoding was cleared
        delete encodingMap[hostname];
      }
    }

    saveConfig({
      ...config,
      network: { ...config.network, encoding_map: encodingMap },
      websites: { ...websites, [key]: updatedSite },
    });
    setRecentlySavedKey(key);
    setEditingKey(null);
  };

  const handleWizardClose = () => setEditingKey(null);

  const toggleEnabled = (key: string) => {
    saveConfig({
      ...config,
      websites: {
        ...websites,
        [key]: { ...websites[key], enabled: !websites[key].enabled },
      },
    }, true);
  };

  const deleteSite = (key: string) => {
    const confirmed = confirm(`确认删除规则「${key}」吗？删除后无法恢复。`);
    if (!confirmed) return;
    const updated = { ...websites };
    delete updated[key];
    const encodingMap = { ...(config.network.encoding_map ?? {}) };
    try {
      const hostname = new URL(websites[key].domain_name).hostname;
      if (hostname) delete encodingMap[hostname];
    } catch {
      const hostname = websites[key].domain_name.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (hostname) delete encodingMap[hostname];
    }
    saveConfig({
      ...config,
      network: { ...config.network, encoding_map: encodingMap },
      websites: updated,
    }, true);
    if (editingKey === key) setEditingKey(null);
  };

  const getRuleStatus = (site: WebsiteConfig) => {
    const required = [
      site.domain_name,
      site.list_novel_name,
      site.release_url,
      site.novel_content,
    ];
    const filled = required.filter(Boolean).length;
    return { filled, total: required.length, complete: filled === required.length };
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 shrink-0">
      <PageHeader
        title={editingKey ? (websites[editingKey] ? "编辑规则" : "新建规则") : "规则管理"}
        subtitle={
          editingKey
            ? "完成所有步骤后点击「应用到网站配置」保存"
            : "为每个站点配置章节解析规则，向导会引导你完成每一步"
        }
        actions={
          editingKey ? (
            <Button variant="secondary" size="sm" onClick={handleWizardClose}>
              <ChevronLeft className="w-3.5 h-3.5" />
              返回列表
            </Button>
          ) : (
            <Button size="sm" onClick={handleNewSite} disabled={saving}>
              <Plus className="w-3.5 h-3.5" />
              新建规则
            </Button>
          )
        }
      />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {siteKeys.length === 0 && editingKey === null && (
          <EmptyState onNew={handleNewSite} />
        )}

        {/* ── Wizard panel ────────────────────────────────────────────────── */}
        {editingKey && (
          <RuleWizard
            site={websites[editingKey] ?? DEFAULT_SITE}
            onApply={(patch) => handleWizardApply(editingKey, patch)}
            onClose={handleWizardClose}
          />
        )}

        {/* ── Site list ───────────────────────────────────────────────────── */}
        {siteKeys.length > 0 && !editingKey && (
          <SiteList
            siteKeys={siteKeys}
            websites={websites}
            getRuleStatus={getRuleStatus}
            recentlySavedKey={recentlySavedKey}
            onEdit={(key) => setEditingKey(key)}
            onToggle={toggleEnabled}
            onDelete={deleteSite}
          />
        )}
      </div>
    </div>
  );
}

// ─── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  const iconRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (iconRef.current) animateFadeInUp(iconRef.current, 0);
    if (textRef.current) animateFadeInUp(textRef.current, 80);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 py-20">
      <div
        ref={iconRef}
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{
          background: "var(--color-accent-muted)",
          border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
          boxShadow: "var(--shadow-accent)",
          opacity: 0,
        }}
      >
        <Wand2 className="w-7 h-7" style={{ color: "var(--color-accent)" }} />
      </div>

      <div ref={textRef} className="text-center" style={{ opacity: 0 }}>
        <p
          className="font-semibold"
          style={{ color: "var(--color-text)", fontSize: "var(--text-lg, 16px)" }}
        >
          还没有站点规则
        </p>
        <p
          className="text-sm mt-1.5 leading-relaxed"
          style={{ color: "var(--color-text-muted)", maxWidth: "28ch", margin: "6px auto 0" }}
        >
          添加一个站点，向导会帮你配置目录页和章节页的解析方式
        </p>
      </div>

      <Button onClick={onNew} style={{ opacity: 0, animation: "fadeIn 250ms ease-out 200ms forwards" }}>
        <Plus className="w-4 h-4" />
        新建规则向导
      </Button>

      <style>{`
        @keyframes fadeIn { to { opacity: 1; } }
      `}</style>
    </div>
  );
}

// ─── SiteList ──────────────────────────────────────────────────────────────────

interface SiteListProps {
  siteKeys: string[];
  websites: Record<string, WebsiteConfig>;
  getRuleStatus: (site: WebsiteConfig) => { filled: number; total: number; complete: boolean };
  recentlySavedKey: string | null;
  onEdit: (key: string) => void;
  onToggle: (key: string) => void;
  onDelete: (key: string) => void;
}

function SiteList({ siteKeys, websites, getRuleStatus, recentlySavedKey, onEdit, onToggle, onDelete }: SiteListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    const rows = listRef.current.querySelectorAll<HTMLElement>("[data-row]");
    if (rows.length) animateStagger(rows, 50);
  }, [siteKeys.length]);

  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold tracking-wide uppercase"
          style={{ color: "var(--color-text-subtle)", letterSpacing: "0.06em" }}
        >
          已配置站点
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
          }}
        >
          {siteKeys.length}
        </span>
      </div>

      {/* Rows */}
      <div ref={listRef} className="flex flex-col gap-2">
        {siteKeys.map((key) => {
          const site = websites[key];
          const status = getRuleStatus(site);
          return (
            <SiteRuleCard
              key={key}
              siteKey={key}
              site={site}
              status={status}
              highlighted={recentlySavedKey === key}
              onEdit={() => onEdit(key)}
              onToggle={() => onToggle(key)}
              onDelete={() => onDelete(key)}
            />
          );
        })}
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

function SiteRuleCard({
  siteKey, site, status, onEdit, onToggle, onDelete,
  highlighted,
}: {
  siteKey: string;
  site: WebsiteConfig;
  status: CardStatus;
  highlighted?: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isEnabled = site.enabled;

  // Clean domain display: strip protocol, trailing slash
  const displayDomain = site.domain_name
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "") || site.domain_name;

  return (
    <div
      data-row
      className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all"
      style={{
        background: isEnabled ? "var(--color-surface)" : "var(--color-surface-1)",
        borderColor: highlighted
          ? "color-mix(in srgb, var(--color-accent) 48%, transparent)"
          : hovered ? "var(--color-border-hover)" : "var(--color-border)",
        boxShadow: highlighted
          ? "var(--shadow-accent)"
          : hovered ? "var(--shadow-md)" : "var(--shadow-sm)",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        transition: "border-color 120ms ease, box-shadow 150ms ease, transform 150ms ease, background 150ms ease",
        // Start invisible — stagger animation sets opacity to 1
        opacity: 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Globe icon — tinted when enabled */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
        style={{
          background: isEnabled
            ? "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface-1))"
            : "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
        }}
      >
        <Globe
          className="w-4 h-4 transition-colors"
          style={{ color: isEnabled ? "var(--color-accent)" : "var(--color-text-subtle)" }}
        />
      </div>

      {/* Info block */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {/* Domain + key */}
        <div className="flex items-baseline gap-2 min-w-0">
          <span
            className="text-sm font-medium truncate"
            style={{ color: "var(--color-text)" }}
            title={site.domain_name}
          >
            {displayDomain}
          </span>
          <span
            className="text-xs shrink-0 font-mono"
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
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{
                background: "var(--color-success-bg)",
                color: "var(--color-success)",
                fontSize: "11px",
              }}
            >
              <CheckCircle2 className="w-2.5 h-2.5" />
              规则完整
            </span>
          ) : (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
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
              className="text-xs px-2 py-0.5 rounded-full"
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
              className="text-xs px-2 py-0.5 rounded-full"
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
              className="text-xs px-2 py-0.5 rounded-full"
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
              className="text-xs px-2 py-0.5 rounded-full"
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

          {site.page_list.length > 1 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
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
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Edit */}
        <ActionButton onClick={onEdit} title="用向导编辑规则">
          <Edit3 className="w-3.5 h-3.5" />
          <span className="text-xs">编辑</span>
          <ChevronRight className="w-3 h-3 opacity-60" />
        </ActionButton>

        {/* Toggle */}
        <IconButton
          onClick={onToggle}
          title={isEnabled ? "停用此站点" : "启用此站点"}
          color={isEnabled ? "var(--color-success)" : "var(--color-text-subtle)"}
        >
          {isEnabled
            ? <ToggleRight className="w-5 h-5" />
            : <ToggleLeft className="w-5 h-5" />
          }
        </IconButton>

        {/* Delete */}
        <IconButton
          onClick={onDelete}
          title="删除此站点规则"
          color="var(--color-danger)"
          hoverBg="var(--color-danger-bg)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function ActionButton({
  onClick, title, children,
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
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
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
  onClick, title, color, hoverBg, children,
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
      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
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

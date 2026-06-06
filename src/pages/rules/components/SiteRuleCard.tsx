import { useState } from "react";
import {
  Globe, ChevronRight, Edit3, ToggleLeft, ToggleRight, Trash2, CheckCircle2, Activity,
  ChevronDown, ChevronUp,
} from "lucide-react";
import type { WebsiteConfig } from "@/types";
import { loadRuleHealth } from "@/lib/ruleHealth";

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

// ─── SiteRuleCard ──────────────────────────────────────────────────────────────

interface CardStatus {
  filled: number;
  total: number;
  complete: boolean;
}

export function SiteRuleCard({
  siteKey, site, status, onEdit, onToggle, onDelete, highlighted, onQuickSave,
}: {
  siteKey: string;
  site: WebsiteConfig;
  status: CardStatus;
  highlighted?: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onQuickSave: (patch: Partial<WebsiteConfig>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draftDomain, setDraftDomain] = useState(site.domain_name);
  const [draftReleaseUrl, setDraftReleaseUrl] = useState(site.release_url);

  const isEnabled = site.enabled;

  // Clean domain display: strip protocol, trailing slash
  const displayDomain = site.domain_name
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "") || site.domain_name;
  const health = loadRuleHealth()[displayDomain];

  return (
    <div
      data-row
      className="flex flex-col px-4 py-3 rounded-xl border transition-all"
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
      {/* Main row */}
      <div className="flex items-center gap-3">
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

            {health && (
              <span
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: health.lastStatus === "success"
                    ? "var(--color-success-bg)"
                    : "var(--color-danger-bg)",
                  color: health.lastStatus === "success"
                    ? "var(--color-success)"
                    : "var(--color-danger)",
                  fontSize: "11px",
                }}
                title={`上次使用: ${new Date(health.lastUsed).toLocaleString("zh-CN")}\n成功 ${health.successCount} 次，失败 ${health.errorCount} 次${health.lastError ? `\n错误: ${health.lastError}` : ""}`}
              >
                <Activity className="w-2.5 h-2.5" />
                {health.lastStatus === "success" ? "上次成功" : "上次失败"}
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

          {/* Quick expand */}
          <IconButton
            onClick={() => {
              setExpanded(v => !v);
              setDraftDomain(site.domain_name);
              setDraftReleaseUrl(site.release_url);
            }}
            title={expanded ? "收起快速编辑" : "展开快速编辑"}
            color="var(--color-text-subtle)"
          >
            {expanded
              ? <ChevronUp className="w-4 h-4" />
              : <ChevronDown className="w-4 h-4" />
            }
          </IconButton>

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

      {/* Expanded quick-edit panel */}
      {expanded && (
        <div
          className="mt-3 pt-3 border-t flex flex-col gap-2"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex gap-2 items-center">
            <label className="text-xs w-14 shrink-0" style={{ color: "var(--color-text-muted)" }}>域名</label>
            <input
              className="flex-1 text-xs px-2 py-1 rounded-lg border"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
                outline: "none",
              }}
              value={draftDomain}
              onChange={e => setDraftDomain(e.target.value)}
            />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-xs w-14 shrink-0" style={{ color: "var(--color-text-muted)" }}>更新页</label>
            <input
              className="flex-1 text-xs px-2 py-1 rounded-lg border"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
                outline: "none",
              }}
              value={draftReleaseUrl}
              onChange={e => setDraftReleaseUrl(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setExpanded(false);
                setDraftDomain(site.domain_name);
                setDraftReleaseUrl(site.release_url);
              }}
              className="text-xs px-3 py-1 rounded-lg border transition-colors"
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
              }}
              className="text-xs px-3 py-1 rounded-lg"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

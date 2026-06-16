import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Edit3,
  Globe,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";

import { loadRuleHealth } from "@/lib/ruleHealth";
import type { WebsiteConfig } from "@/types";

import { ActionButton } from "./rule-card/ActionButton";
import { IconButton } from "./rule-card/IconButton";
import { SiteCardBadges } from "./rule-card/SiteCardBadges";
import { SiteCardExpandedPanel } from "./rule-card/SiteCardExpandedPanel";

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
  onQuickSave: (patch: Partial<WebsiteConfig>) => void | Promise<void>;
  onDuplicate: () => void;
  dragHandle?: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
          <SiteCardBadges status={status} site={site} highlighted={highlighted} health={health} />
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
            onClick={() => setExpanded((v) => !v)}
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
        <SiteCardExpandedPanel
          site={site}
          onClose={() => setExpanded(false)}
          onQuickSave={onQuickSave}
        />
      )}
    </div>
  );
}

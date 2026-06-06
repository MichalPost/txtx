import { useRef, useEffect } from "react";
import { animateStagger } from "@/lib/animations";
import { SiteRuleCard } from "./SiteRuleCard";
import type { WebsiteConfig } from "@/types";

interface SiteListProps {
  siteKeys: string[];
  websites: Record<string, WebsiteConfig>;
  getRuleStatus: (site: WebsiteConfig) => { filled: number; total: number; complete: boolean };
  recentlySavedKey: string | null;
  onEdit: (key: string) => void;
  onToggle: (key: string) => void;
  onDelete: (key: string) => void;
  onQuickSave: (key: string, patch: Partial<WebsiteConfig>) => void;
}

export function SiteList({
  siteKeys, websites, getRuleStatus, recentlySavedKey, onEdit, onToggle, onDelete, onQuickSave,
}: SiteListProps) {
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
              onQuickSave={(patch) => onQuickSave(key, patch)}
            />
          );
        })}
      </div>
    </div>
  );
}

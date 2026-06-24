import { lazy, Suspense, useEffect, useRef } from "react";

import { animateStagger } from "@/lib/animations";
import type { WebsiteConfig } from "@/types";

import { SiteRuleCard } from "./SiteRuleCard";

const SortableSiteList = lazy(() =>
  import("./SortableSiteList").then((module) => ({ default: module.SortableSiteList })),
);

interface SiteListProps {
  siteKeys: string[];
  visibleSiteKeys?: string[];
  mode?: "browse" | "sort";
  websites: Record<string, WebsiteConfig>;
  getRuleStatus: (site: WebsiteConfig) => { filled: number; total: number; complete: boolean };
  recentlySavedKey: string | null;
  onEdit: (key: string) => void;
  onToggle: (key: string) => void;
  onDelete: (key: string) => void;
  onQuickSave: (key: string, patch: Partial<WebsiteConfig>) => void | Promise<void>;
  onReorder: (orderedKeys: string[]) => void;
  onDuplicate: (key: string) => void;
}

function SiteRow({
  siteKey,
  site,
  status,
  highlighted,
  onEdit,
  onToggle,
  onDelete,
  onQuickSave,
  onDuplicate,
}: {
  siteKey: string;
  site: WebsiteConfig;
  status: { filled: number; total: number; complete: boolean };
  highlighted?: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onQuickSave: (patch: Partial<WebsiteConfig>) => void | Promise<void>;
  onDuplicate: () => void;
}) {
  return (
    <SiteRuleCard
      siteKey={siteKey}
      site={site}
      status={status}
      highlighted={highlighted}
      onEdit={onEdit}
      onToggle={onToggle}
      onDelete={onDelete}
      onQuickSave={onQuickSave}
      onDuplicate={onDuplicate}
    />
  );
}

export function SiteList({
  siteKeys,
  visibleSiteKeys,
  mode = "browse",
  websites,
  getRuleStatus,
  recentlySavedKey,
  onEdit,
  onToggle,
  onDelete,
  onQuickSave,
  onReorder,
  onDuplicate,
}: SiteListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const isSortMode = mode === "sort";
  const renderedKeys = visibleSiteKeys ?? siteKeys;

  useEffect(() => {
    if (!listRef.current) return;
    const rows = listRef.current.querySelectorAll<HTMLElement>("[data-row]");
    if (rows.length) animateStagger(rows, 50);
  }, [renderedKeys.length]);

  const renderStaticRows = () => (
    <div ref={listRef} className="flex flex-col gap-2">
      {renderedKeys.map((key) => {
        const site = websites[key];
        if (!site) return null;
        const status = getRuleStatus(site);
        return (
          <SiteRow
            key={key}
            siteKey={key}
            site={site}
            status={status}
            highlighted={recentlySavedKey === key}
            onEdit={() => onEdit(key)}
            onToggle={() => onToggle(key)}
            onDelete={() => onDelete(key)}
            onQuickSave={(patch) => onQuickSave(key, patch)}
            onDuplicate={() => onDuplicate(key)}
          />
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span
            className="text-xs font-semibold tracking-wide uppercase"
            style={{ color: "var(--color-text-subtle)", letterSpacing: "0.06em" }}
          >
            已保存规则
          </span>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {isSortMode
              ? "可拖拽左侧手柄调整优先级，也支持键盘：聚焦手柄后按空格开始，再用方向键排序。"
              : "浏览模式只渲染当前可见批次；需要调整优先级时可切换到排序模式。"}
          </span>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
          }}
        >
          {isSortMode ? siteKeys.length : renderedKeys.length}/{siteKeys.length}
        </span>
      </div>

      {isSortMode ? (
        <Suspense
          fallback={
            <div
              className="rounded-xl border px-4 py-4 text-sm"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              正在加载排序工具...
            </div>
          }
        >
          <SortableSiteList
            siteKeys={siteKeys}
            websites={websites}
            getRuleStatus={getRuleStatus}
            recentlySavedKey={recentlySavedKey}
            onEdit={onEdit}
            onToggle={onToggle}
            onDelete={onDelete}
            onQuickSave={onQuickSave}
            onReorder={onReorder}
            onDuplicate={onDuplicate}
          />
        </Suspense>
      ) : (
        renderStaticRows()
      )}
    </div>
  );
}

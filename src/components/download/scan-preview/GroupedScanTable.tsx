import { useMemo, useState } from "react";

import { ChevronDown, Globe } from "lucide-react";

import type { ScanItem } from "@/types";

import { ScanRow } from "./ScanRow";

export function GroupedScanTable({
  items,
  selectedUrls,
  onToggle,
  onForceAdd,
}: {
  items: ScanItem[];
  selectedUrls: Set<string>;
  onToggle: (url: string) => void;
  onForceAdd: (item: ScanItem) => void;
}) {
  const groups = useMemo(() => {
    const map: Record<string, ScanItem[]> = {};
    items.forEach((i) => {
      if (!map[i.site]) map[i.site] = [];
      map[i.site].push(i);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [items]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleGroup(site: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(site)) next.delete(site);
      else next.add(site);
      return next;
    });
  }

  function selectGroup(site: string, value: boolean) {
    const groupItems = groups.find(([s]) => s === site)?.[1] ?? [];
    groupItems
      .filter((i) => !i.excluded_reason)
      .forEach((i) => {
        const has = selectedUrls.has(i.url);
        if (value && !has) onToggle(i.url);
        if (!value && has) onToggle(i.url);
      });
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map(([site, groupItems]) => {
        const domain = site.replace(/^https?:\/\//, "");
        const isCollapsed = collapsed.has(site);
        const pendingItems = groupItems.filter((i) => !i.excluded_reason);
        const selectedInGroup = pendingItems.filter((i) => selectedUrls.has(i.url)).length;
        const allGroupSelected = pendingItems.length > 0 && selectedInGroup === pendingItems.length;
        return (
          <div
            key={site}
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div
              className="flex cursor-pointer items-center gap-2 px-3 py-2.5 transition-colors select-none"
              style={{ background: "var(--color-surface-1)" }}
              onClick={() => toggleGroup(site)}
            >
              <input
                type="checkbox"
                checked={allGroupSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  selectGroup(site, e.target.checked);
                }}
                onClick={(e) => e.stopPropagation()}
                className="rounded focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                style={{ accentColor: "var(--color-accent)" }}
              />
              <Globe
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: "var(--color-text-muted)" }}
              />
              <span
                className="flex-1 truncate text-xs font-semibold"
                style={{ color: "var(--color-text)" }}
              >
                {domain}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-xs tabular-nums"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                  color: "var(--color-accent)",
                }}
              >
                {pendingItems.length} 待下载
              </span>
              {groupItems.length - pendingItems.length > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs tabular-nums"
                  style={{
                    background: "color-mix(in srgb, var(--color-text-muted) 10%, transparent)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {groupItems.length - pendingItems.length} 排除
                </span>
              )}
              <ChevronDown
                className="h-3.5 w-3.5 shrink-0 transition-transform"
                style={{
                  color: "var(--color-text-muted)",
                  transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                }}
              />
            </div>
            {!isCollapsed && (
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {groupItems.map((item) => (
                    <ScanRow
                      key={item.url}
                      item={item}
                      checked={selectedUrls.has(item.url)}
                      onToggle={() => onToggle(item.url)}
                      onForceAdd={item.excluded_reason ? () => onForceAdd(item) : undefined}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

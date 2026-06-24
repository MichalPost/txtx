import { useMemo } from "react";

import { Button } from "@/components/Button";
import { useTaskStore } from "@/store/taskStore";
import type { ScanItem } from "@/types";

type ScanSortKey = "name" | "site" | "date";

export function ScanPreviewPanel({
  taskId,
  items,
  onConfirm,
  confirmPending = false,
  confirmError = "",
}: {
  taskId: string;
  items: ScanItem[];
  onConfirm: (selected: string[]) => void;
  confirmPending?: boolean;
  confirmError?: string;
}) {
  const eligible = items.filter((i) => !i.excluded_reason);
  const { getPreviewDraft, updatePreviewDraft } = useTaskStore();
  const draft = getPreviewDraft(taskId, items);
  const deselected = useMemo(() => new Set(draft.deselected_urls), [draft.deselected_urls]);
  const siteFilter = draft.site_filter;
  const scanSort = draft.scan_sort as ScanSortKey;
  const visibleCount = draft.visible_count;
  const selected = useMemo(
    () => new Set(eligible.map((item) => item.url).filter((url) => !deselected.has(url))),
    [deselected, eligible],
  );

  // Derive unique sites
  const sites = useMemo(() => [...new Set(items.map((i) => i.site))].sort(), [items]);

  // Filter then sort
  const visible = useMemo(() => {
    const list = siteFilter ? items.filter((i) => i.site === siteFilter) : items;
    const sorted = [...list];
    if (scanSort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "zh"));
    if (scanSort === "site") sorted.sort((a, b) => a.site.localeCompare(b.site));
    if (scanSort === "date") sorted.sort((a, b) => b.date.localeCompare(a.date));
    return sorted;
  }, [items, siteFilter, scanSort]);
  const visibleItems = useMemo(() => visible.slice(0, visibleCount), [visible, visibleCount]);

  const toggle = (url: string) => {
    const next = new Set(deselected);
    if (selected.has(url)) next.add(url);
    else next.delete(url);
    updatePreviewDraft(taskId, { deselected_urls: Array.from(next) });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          扫描结果 — {eligible.length} 本可下载
        </p>
        {/* Filters + sort row */}
        <div className="flex flex-wrap items-center gap-2">
          {sites.length > 1 && (
          <select
            value={siteFilter}
            onChange={(e) =>
              updatePreviewDraft(taskId, {
                site_filter: e.target.value,
                visible_count: 100,
              })
            }
            disabled={confirmPending}
            className="rounded-lg border px-2 py-1 text-xs"
            style={{
              background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              <option value="">全部站点</option>
              {sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          <select
            value={scanSort}
            onChange={(e) =>
              updatePreviewDraft(taskId, { scan_sort: e.target.value as ScanSortKey })
            }
            disabled={confirmPending}
            className="rounded-lg border px-2 py-1 text-xs"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            <option value="date">按日期</option>
            <option value="name">按名称</option>
            <option value="site">按站点</option>
          </select>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              updatePreviewDraft(taskId, {
                deselected_urls: eligible.map((item) => item.url),
              })
            }
            disabled={confirmPending}
          >
            全不选
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => updatePreviewDraft(taskId, { deselected_urls: [] })}
            disabled={confirmPending}
          >
            全选
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0 || confirmPending}
            onClick={() => onConfirm(Array.from(selected))}
          >
            {confirmPending ? `提交中... (${selected.size})` : `下载选中 (${selected.size})`}
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between text-xs" style={{ color: "var(--color-text-muted)" }}>
        <span>
          当前显示 {visibleItems.length} / {visible.length} 条
          {siteFilter ? ` · 已筛选站点 ${siteFilter}` : ""}
        </span>
        {visible.length > visibleCount ? (
          <button
            type="button"
            onClick={() => updatePreviewDraft(taskId, { visible_count: visibleCount + 100 })}
            className="rounded-lg border px-2.5 py-1 transition-colors hover:opacity-80"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
          >
            再加载 100 条
          </button>
        ) : null}
      </div>

      {confirmError && (
        <div
          className="rounded-lg border px-3 py-2 text-xs"
          style={{
            background: "var(--color-danger-bg)",
            borderColor: "color-mix(in srgb, var(--color-danger) 35%, transparent)",
            color: "var(--color-danger)",
          }}
        >
          {confirmError}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <div
            key={item.url}
            className="flex items-center gap-2 rounded-lg border px-3 py-2"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              opacity: item.excluded_reason ? 0.5 : 1,
            }}
          >
            {!item.excluded_reason && (
              <input
                type="checkbox"
                checked={selected.has(item.url)}
                disabled={confirmPending}
                onChange={() => toggle(item.url)}
                className="shrink-0 accent-[var(--color-accent)]"
              />
            )}
            {item.excluded_reason && <div className="w-4 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium" style={{ color: "var(--color-text)" }}>
                {item.name}
              </p>
              <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                {item.site}，{item.date}
                {item.excluded_reason && `，${item.excluded_reason}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

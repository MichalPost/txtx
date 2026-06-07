import { useMemo, useState } from "react";

import { Button } from "@/components/Button";
import type { ScanItem } from "@/types";

type ScanSortKey = "name" | "site" | "date";

export function ScanPreviewPanel({
  items,
  onConfirm,
}: {
  items: ScanItem[];
  onConfirm: (selected: string[]) => void;
}) {
  const eligible = items.filter((i) => !i.excluded_reason);
  const [selected, setSelected] = useState<Set<string>>(new Set(eligible.map((i) => i.url)));
  const [siteFilter, setSiteFilter] = useState("");
  const [scanSort, setScanSort] = useState<ScanSortKey>("date");

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

  const toggle = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
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
              onChange={(e) => setSiteFilter(e.target.value)}
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
            onChange={(e) => setScanSort(e.target.value as ScanSortKey)}
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
          <Button variant="secondary" size="sm" onClick={() => setSelected(new Set())}>
            全不选
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelected(new Set(eligible.map((i) => i.url)))}
          >
            全选
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0}
            onClick={() => onConfirm(Array.from(selected))}
          >
            下载选中 ({selected.size})
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {visible.map((item) => (
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

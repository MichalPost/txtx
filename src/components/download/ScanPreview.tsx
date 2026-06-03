import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, ChevronDown, ChevronUp, Download, RotateCcw,
  ListChecks, Filter, PlusCircle, Globe,
  FileJson, FileText, BarChart2,
} from "lucide-react";
import { useDownloadStore } from "@/store/downloadStore";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { animateCountUp } from "@/lib/animations";
import { usePersistedState } from "@/lib/persist";
import type { ScanItem } from "@/types";

// ─── ExcludedBadge ────────────────────────────────────────────────────────────

function ExcludedBadge({ reason }: { reason: string }) {
  const isBlacklist = reason.startsWith("黑名单");
  const isLocal = reason === "本地已存在";
  const color = isBlacklist ? "var(--color-danger)" : isLocal ? "var(--color-text-muted)" : "var(--color-warning)";
  const bg = isBlacklist
    ? "color-mix(in srgb, var(--color-danger) 12%, transparent)"
    : isLocal
    ? "color-mix(in srgb, var(--color-text-muted) 12%, transparent)"
    : "color-mix(in srgb, var(--color-warning) 12%, transparent)";
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full truncate max-w-full"
      style={{ background: bg, color }}
      title={reason}
    >
      <Filter className="w-2.5 h-2.5 shrink-0" />
      {reason.length > 10 ? reason.slice(0, 10) + "…" : reason}
    </span>
  );
}

// ─── ScanRow ──────────────────────────────────────────────────────────────────

function ScanRow({
  item, checked, onToggle, onForceAdd,
}: {
  item: ScanItem; checked: boolean; onToggle: () => void; onForceAdd?: () => void;
}) {
  const isExcluded = !!item.excluded_reason;
  const domain = item.site.replace(/^https?:\/\//, "");
  return (
    <tr
      className="border-t group transition-colors"
      style={{
        borderColor: "var(--color-border)",
        background: checked && !isExcluded ? "color-mix(in srgb, var(--color-accent) 6%, transparent)" : undefined,
        opacity: isExcluded && !checked ? 0.55 : 1,
      }}
    >
      <td className="px-3 py-2">
        <input type="checkbox" checked={checked} onChange={onToggle} className="rounded"
          style={{ accentColor: "var(--color-accent)" }} />
      </td>
      <td className="px-3 py-2 font-medium max-w-xs" style={{ color: "var(--color-text)" }}>
        <span className="truncate block">{item.name}</span>
      </td>
      <td className="px-3 py-2 text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{domain}</td>
      <td className="px-3 py-2 text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>{item.date}</td>
      <td className="px-3 py-2">
        {isExcluded ? (
          <div className="flex items-center gap-1.5">
            <ExcludedBadge reason={item.excluded_reason!} />
            {onForceAdd && (
              <button onClick={onForceAdd} title="强制加入下载"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--color-accent)" }}>
                <PlusCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
            style={{ background: "color-mix(in srgb, var(--color-success) 15%, transparent)", color: "var(--color-success)" }}>
            待下载
          </span>
        )}
      </td>
    </tr>
  );
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportCsv(items: ScanItem[], onlySelected: boolean, selectedUrls: Set<string>) {
  const rows = onlySelected ? items.filter((i) => selectedUrls.has(i.url)) : items;
  const header = "书名,来源,日期,状态";
  const lines = rows.map((i) =>
    `"${i.name.replace(/"/g, '""')}","${i.site}","${i.date}","${i.excluded_reason ?? "待下载"}"`
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "书单.csv"; a.click();
  URL.revokeObjectURL(url);
}

function exportJson(items: ScanItem[], onlySelected: boolean, selectedUrls: Set<string>) {
  const rows = onlySelected ? items.filter((i) => selectedUrls.has(i.url)) : items;
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "书单.json"; a.click();
  URL.revokeObjectURL(url);
}

function ExportDropdown({ scanItems, selectedUrls, onClose }: {
  scanItems: ScanItem[]; selectedUrls: Set<string>; onClose: () => void;
}) {
  type ExportItem = { label: string; fn: () => void; icon: typeof FileText };
  const items: ExportItem[] = [
    { label: "导出全部 CSV", fn: () => exportCsv(scanItems, false, selectedUrls), icon: FileText },
    { label: "导出已选 CSV", fn: () => exportCsv(scanItems, true, selectedUrls), icon: FileText },
    { label: "导出全部 JSON", fn: () => exportJson(scanItems, false, selectedUrls), icon: FileJson },
    { label: "导出已选 JSON", fn: () => exportJson(scanItems, true, selectedUrls), icon: FileJson },
  ];
  return (
    <div className="absolute right-0 top-full mt-1 rounded-lg border shadow-lg z-50 overflow-hidden"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      {items.map(({ label, fn, icon: Icon }) => (
        <button key={label} onClick={() => { fn(); onClose(); }}
          className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 border-b last:border-0 hover:opacity-80 transition-opacity"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
          <Icon className="w-3.5 h-3.5" style={{ color: "var(--color-text-muted)" }} />
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── SiteStatsChart ───────────────────────────────────────────────────────────

function SiteStatsChart({ items }: { items: ScanItem[] }) {
  const siteStats = useMemo(() => {
    const map: Record<string, { pending: number; excluded: number }> = {};
    items.forEach((i) => {
      const key = i.site.replace(/^https?:\/\//, "");
      if (!map[key]) map[key] = { pending: 0, excluded: 0 };
      if (i.excluded_reason) map[key].excluded++;
      else map[key].pending++;
    });
    return Object.entries(map)
      .map(([site, counts]) => ({ site, ...counts, total: counts.pending + counts.excluded }))
      .sort((a, b) => b.total - a.total);
  }, [items]);

  const maxTotal = Math.max(...siteStats.map((s) => s.total), 1);

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3 rounded-xl border"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <div className="flex items-center gap-1.5 mb-1">
        <BarChart2 className="w-3.5 h-3.5" style={{ color: "var(--color-accent)" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>各站点分布</span>
        <div className="ml-auto flex items-center gap-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "var(--color-accent)" }} />待下载
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: "var(--color-border)" }} />已排除
          </span>
        </div>
      </div>
      {siteStats.map(({ site, pending, excluded, total }) => (
        <div key={site} className="flex items-center gap-2">
          <span className="text-xs w-28 truncate shrink-0" style={{ color: "var(--color-text-muted)" }} title={site}>{site}</span>
          <div className="flex-1 h-4 rounded-full overflow-hidden flex" style={{ background: "var(--color-surface-1)" }}>
            <div className="h-full rounded-l-full transition-all duration-500"
              style={{ width: `${(pending / maxTotal) * 100}%`, background: "var(--color-accent)", minWidth: pending > 0 ? 4 : 0 }} />
            <div className="h-full transition-all duration-500"
              style={{ width: `${(excluded / maxTotal) * 100}%`, background: "color-mix(in srgb, var(--color-text-muted) 30%, transparent)", minWidth: excluded > 0 ? 4 : 0 }} />
          </div>
          <span className="text-xs tabular-nums w-8 text-right shrink-0 font-medium" style={{ color: "var(--color-text)" }}>{total}</span>
        </div>
      ))}
    </div>
  );
}

// ─── GroupedScanTable ─────────────────────────────────────────────────────────

function GroupedScanTable({
  items, selectedUrls, onToggle, onForceAdd,
}: {
  items: ScanItem[]; selectedUrls: Set<string>;
  onToggle: (url: string) => void; onForceAdd: (item: ScanItem) => void;
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
      if (next.has(site)) next.delete(site); else next.add(site);
      return next;
    });
  }

  function selectGroup(site: string, value: boolean) {
    const groupItems = groups.find(([s]) => s === site)?.[1] ?? [];
    groupItems.filter((i) => !i.excluded_reason).forEach((i) => {
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
          <div key={site} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none transition-colors"
              style={{ background: "var(--color-surface-1)" }} onClick={() => toggleGroup(site)}>
              <input type="checkbox" checked={allGroupSelected}
                onChange={(e) => { e.stopPropagation(); selectGroup(site, e.target.checked); }}
                onClick={(e) => e.stopPropagation()} className="rounded"
                style={{ accentColor: "var(--color-accent)" }} />
              <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
              <span className="flex-1 text-xs font-semibold truncate" style={{ color: "var(--color-text)" }}>{domain}</span>
              <span className="text-xs px-2 py-0.5 rounded-full tabular-nums"
                style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)", color: "var(--color-accent)" }}>
                {pendingItems.length} 待下载
              </span>
              {groupItems.length - pendingItems.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full tabular-nums"
                  style={{ background: "color-mix(in srgb, var(--color-text-muted) 10%, transparent)", color: "var(--color-text-muted)" }}>
                  {groupItems.length - pendingItems.length} 排除
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform"
                style={{ color: "var(--color-text-muted)", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }} />
            </div>
            {!isCollapsed && (
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {groupItems.map((item) => (
                    <ScanRow key={item.url} item={item} checked={selectedUrls.has(item.url)}
                      onToggle={() => onToggle(item.url)}
                      onForceAdd={item.excluded_reason ? () => onForceAdd(item) : undefined} />
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

// ─── ScanPreview ─────────────────────────────────────────────────────────────

type FilterTab = "all" | "pending" | "excluded";
type ViewMode = "flat" | "grouped";

export function ScanPreview() {
  const { scanItems, selectedUrls, scanStats, toggleSelect, selectAll, startSelectedDownload, startScan, stopDownload } = useDownloadStore();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("pending");
  const [sortField, setSortField] = useState<"name" | "site" | "date">("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSiteFilter, setShowSiteFilter] = useState(false);
  const [viewMode, setViewMode] = usePersistedState<ViewMode>("scan-view-mode", "grouped");
  const [showChart, setShowChart] = usePersistedState<boolean>("scan-show-chart", false);  const selectedCountRef = useRef<HTMLSpanElement>(null);
  const prevSelectedCount = useRef(0);

  const pendingCount = scanItems.filter((i) => !i.excluded_reason).length;
  const excludedCount = scanItems.filter((i) => !!i.excluded_reason).length;
  const selectedCount = selectedUrls.size;

  useEffect(() => {
    if (selectedCountRef.current && selectedCount !== prevSelectedCount.current) {
      animateCountUp(selectedCountRef.current, prevSelectedCount.current, selectedCount, 300);
      prevSelectedCount.current = selectedCount;
    }
  }, [selectedCount]);

  const filtered = useMemo(() => {
    let list = scanItems;
    if (tab === "pending") list = list.filter((i) => !i.excluded_reason);
    if (tab === "excluded") list = list.filter((i) => !!i.excluded_reason);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.site.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const va = a[sortField] ?? ""; const vb = b[sortField] ?? "";
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [scanItems, tab, search, sortField, sortAsc]);

  const sites = useMemo(() => [...new Set(scanItems.map((i) => i.site))], [scanItems]);
  const allPendingSelected = pendingCount > 0 && pendingCount === selectedCount;
  const blacklistCount = scanItems.filter((i) => i.excluded_reason?.startsWith("黑名单")).length;
  const localCount = scanItems.filter((i) => i.excluded_reason === "本地已存在").length;

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortAsc((v) => !v);
    else { setSortField(field); setSortAsc(true); }
  }

  function SortIcon({ field }: { field: typeof sortField }) {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  }

  function forceAdd(item: ScanItem) {
    if (!selectedUrls.has(item.url)) toggleSelect(item.url);
  }

  function selectBySite(site: string) {
    const urls = scanItems.filter((i) => i.site === site && !i.excluded_reason).map((i) => i.url);
    urls.forEach((u) => { if (!selectedUrls.has(u)) toggleSelect(u); });
    setShowSiteFilter(false);
  }

  function forceAddAllBlacklisted() {
    scanItems.filter((i) => i.excluded_reason?.startsWith("黑名单")).forEach((i) => {
      if (!selectedUrls.has(i.url)) toggleSelect(i.url);
    });
  }

  function forceAddAllLocal() {
    scanItems.filter((i) => i.excluded_reason === "本地已存在").forEach((i) => {
      if (!selectedUrls.has(i.url)) toggleSelect(i.url);
    });
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Stats bar */}
      {scanStats && (
        <div className="flex gap-2 flex-wrap shrink-0 min-w-0">
          {([
            ["收集", scanStats.total_collected, "var(--color-text-muted)"],
            ["去重后", scanStats.after_dedup, "var(--color-text-muted)"],
            ["黑名单", scanStats.blacklist_filtered, "var(--color-warning)"],
            ["已存在", scanStats.local_exists, "var(--color-text-muted)"],
            ["待下载", scanStats.final_download, "var(--color-accent)"],
          ] as [string, number, string][]).map(([label, val, color]) => (
            <div key={label} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border shrink-0"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
              <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
              <span className="font-semibold tabular-nums" style={{ color }}>{val}</span>
            </div>
          ))}
          <button onClick={() => setShowChart(!showChart)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{
              background: showChart ? "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))" : "var(--color-surface)",
              borderColor: showChart ? "var(--color-accent)" : "var(--color-border)",
              color: showChart ? "var(--color-accent)" : "var(--color-text-muted)",
            }}>
            <BarChart2 className="w-3.5 h-3.5" />分布图
          </button>
        </div>
      )}

      {showChart && <div className="shrink-0"><SiteStatsChart items={scanItems} /></div>}

      {/* Toolbar */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--color-border)" }}>
          {([
            ["all", `全部 ${scanItems.length}`],
            ["pending", `待下载 ${pendingCount}`],
            ["excluded", `已排除 ${excludedCount}`],
          ] as [FilterTab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: tab === t ? "var(--color-accent)" : "var(--color-surface-1)",
                color: tab === t ? "#fff" : "var(--color-text-muted)",
              }}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-28 flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--color-text-subtle)" }} />
          <Input className="pl-8 h-8 text-xs w-full" placeholder="搜索书名或站点..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--color-border)" }}>
          {([["grouped", "分组", Globe], ["flat", "列表", ListChecks]] as [ViewMode, string, typeof Globe][]).map(([mode, label, Icon]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: viewMode === mode ? "var(--color-accent)" : "var(--color-surface-1)",
                color: viewMode === mode ? "#fff" : "var(--color-text-muted)",
              }}>
              <Icon className="w-3 h-3" />{label}
            </button>
          ))}
        </div>
        {/* Right-side actions — wrap as a unit */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => selectAll(!allPendingSelected)}>
            <ListChecks className="w-3.5 h-3.5" />
            {allPendingSelected ? "取消全选" : "全选待下载"}
          </Button>
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => setShowSiteFilter((v) => !v)}>
              <Globe className="w-3.5 h-3.5" /> 按站点<ChevronDown className="w-3 h-3" />
            </Button>
            {showSiteFilter && (
              <div className="absolute right-0 top-full mt-1 rounded-lg border shadow-lg z-50 min-w-40 overflow-hidden"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                {sites.map((site) => {
                  const count = scanItems.filter((i) => i.site === site && !i.excluded_reason).length;
                  return (
                    <button key={site} onClick={() => selectBySite(site)}
                      className="w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-3 border-b last:border-0 hover:opacity-80 transition-opacity"
                      style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
                      <span className="truncate">{site.replace(/^https?:\/\//, "")}</span>
                      <span style={{ color: "var(--color-accent)" }}>{count}</span>
                    </button>
                  );
                })}
                {blacklistCount > 0 && (
                  <button onClick={forceAddAllBlacklisted}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 border-t hover:opacity-80 transition-opacity"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-warning)" }}>
                    <Filter className="w-3 h-3" /> 全部黑名单加入 ({blacklistCount})
                  </button>
                )}
                {localCount > 0 && (
                  <button onClick={forceAddAllLocal}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 border-t hover:opacity-80 transition-opacity"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
                    <PlusCircle className="w-3 h-3" /> 全部已存在加入 ({localCount})
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => setShowExport((v) => !v)}>
              <FileText className="w-3.5 h-3.5" /> 导出<ChevronDown className="w-3 h-3" />
            </Button>
            {showExport && (
              <ExportDropdown scanItems={scanItems} selectedUrls={selectedUrls} onClose={() => setShowExport(false)} />
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => startScan()}>
            <RotateCcw className="w-3.5 h-3.5" /> 重新扫描
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {viewMode === "grouped" && !search.trim() ? (
          <GroupedScanTable items={filtered} selectedUrls={selectedUrls} onToggle={toggleSelect} onForceAdd={forceAdd} />
        ) : (
          <div className="rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10" style={{ background: "var(--color-surface-1)" }}>
                <tr>
                  <th className="w-10 px-3 py-2.5 text-left">
                    <input type="checkbox" checked={allPendingSelected} onChange={(e) => selectAll(e.target.checked)}
                      className="rounded" style={{ accentColor: "var(--color-accent)" }} />
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium cursor-pointer select-none"
                    style={{ color: "var(--color-text-muted)" }} onClick={() => toggleSort("name")}>
                    书名 <SortIcon field="name" />
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium cursor-pointer select-none w-36"
                    style={{ color: "var(--color-text-muted)" }} onClick={() => toggleSort("site")}>
                    来源 <SortIcon field="site" />
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium cursor-pointer select-none w-28"
                    style={{ color: "var(--color-text-muted)" }} onClick={() => toggleSort("date")}>
                    日期 <SortIcon field="date" />
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium w-36" style={{ color: "var(--color-text-muted)" }}>状态</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {search ? "没有匹配的结果" : "暂无数据"}
                  </td></tr>
                ) : filtered.map((item) => (
                  <ScanRow key={item.url} item={item} checked={selectedUrls.has(item.url)}
                    onToggle={() => toggleSelect(item.url)}
                    onForceAdd={item.excluded_reason ? () => forceAdd(item) : undefined} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between shrink-0 pt-1">
        <div className="flex items-center gap-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
          <span>已选 <span ref={selectedCountRef} className="font-semibold" style={{ color: "var(--color-accent)" }}>{selectedCount}</span> 本</span>
          {selectedCount > pendingCount && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "color-mix(in srgb, var(--color-warning) 12%, transparent)", color: "var(--color-warning)" }}>
              含 {selectedCount - pendingCount} 本强制加入
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => stopDownload()}>
            <Download className="w-3.5 h-3.5" /> 取消
          </Button>
          <Button size="sm" onClick={startSelectedDownload} disabled={selectedCount === 0}>
            <Download className="w-3.5 h-3.5" /> 开始下载 {selectedCount > 0 ? `(${selectedCount})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

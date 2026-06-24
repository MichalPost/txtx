import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { ScanItem } from "@/types";

import { ScanRow } from "./ScanRow";
import type { ScanSortField } from "./scanPreviewUtils";

function SortIcon({
  field,
  sortField,
  sortAsc,
}: {
  field: "name" | "site" | "date";
  sortField: "name" | "site" | "date";
  sortAsc: boolean;
}) {
  if (sortField !== field) return null;
  return sortAsc ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="ml-0.5 inline h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="ml-0.5 inline h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function FlatScanTable({
  filtered,
  selectedUrls,
  allPendingSelected,
  search,
  sortField,
  sortAsc,
  onSelectAll,
  onToggleSort,
  onToggle,
  onForceAdd,
}: {
  filtered: ScanItem[];
  selectedUrls: Set<string>;
  allPendingSelected: boolean;
  search: string;
  sortField: ScanSortField;
  sortAsc: boolean;
  onSelectAll: (value: boolean) => void;
  onToggleSort: (field: ScanSortField) => void;
  onToggle: (url: string) => void;
  onForceAdd: (item: ScanItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 41,
    overscan: 12,
  });

  return (
    <div
      ref={scrollRef}
      className="max-h-full overflow-auto rounded-lg border"
      style={{ borderColor: "var(--color-border)" }}
    >
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-10" />
          <col />
          <col className="w-36" />
          <col className="w-28" />
          <col className="w-36" />
        </colgroup>
        <thead className="sticky top-0 z-10" style={{ background: "var(--color-surface-1)" }}>
          <tr>
            <th className="w-10 px-3 py-2.5 text-left">
              <input
                type="checkbox"
                id="scan-preview-select-all"
                name="scan-preview-select-all"
                aria-label="选择所有待下载项目"
                checked={allPendingSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="rounded focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                style={{ accentColor: "var(--color-accent)" }}
              />
            </th>
            <th
              className="cursor-pointer px-3 py-2.5 text-left font-medium select-none"
              style={{ color: "var(--color-text-muted)" }}
              onClick={() => onToggleSort("name")}
            >
              书名 <SortIcon field="name" sortField={sortField} sortAsc={sortAsc} />
            </th>
            <th
              className="w-36 cursor-pointer px-3 py-2.5 text-left font-medium select-none"
              style={{ color: "var(--color-text-muted)" }}
              onClick={() => onToggleSort("site")}
            >
              来源 <SortIcon field="site" sortField={sortField} sortAsc={sortAsc} />
            </th>
            <th
              className="w-28 cursor-pointer px-3 py-2.5 text-left font-medium select-none"
              style={{ color: "var(--color-text-muted)" }}
              onClick={() => onToggleSort("date")}
            >
              日期 <SortIcon field="date" sortField={sortField} sortAsc={sortAsc} />
            </th>
            <th
              className="w-36 px-3 py-2.5 text-left font-medium"
              style={{ color: "var(--color-text-muted)" }}
            >
              状态
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="py-12 text-center text-sm"
                style={{ color: "var(--color-text-muted)" }}
              >
                {search ? `没有书名或站点匹配「${search}」` : "扫描完成后书单会出现在这里"}
              </td>
            </tr>
          ) : (
            <tr>
              <td
                colSpan={5}
                className="p-0"
                style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const item = filtered[virtualRow.index];
                  return (
                    <div
                      key={item.url}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <table className="w-full table-fixed border-collapse text-sm">
                        <colgroup>
                          <col className="w-10" />
                          <col />
                          <col className="w-36" />
                          <col className="w-28" />
                          <col className="w-36" />
                        </colgroup>
                        <tbody>
                          <ScanRow
                            item={item}
                            checked={selectedUrls.has(item.url)}
                            onToggle={() => onToggle(item.url)}
                            onForceAdd={item.excluded_reason ? () => onForceAdd(item) : undefined}
                          />
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

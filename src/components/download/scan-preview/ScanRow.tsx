import { memo } from "react";
import { PlusCircle } from "lucide-react";

import type { ScanItem } from "@/types";

import { ExcludedBadge } from "./ExcludedBadge";

export const ScanRow = memo(function ScanRow({
  item,
  checked,
  onToggle,
  onForceAdd,
}: {
  item: ScanItem;
  checked: boolean;
  onToggle: () => void;
  onForceAdd?: () => void;
}) {
  const isExcluded = !!item.excluded_reason;
  const domain = item.site.replace(/^https?:\/\//, "");
  return (
    <tr
      className="group border-t transition-colors"
      style={{
        borderColor: "var(--color-border)",
        background:
          checked && !isExcluded
            ? "color-mix(in srgb, var(--color-accent) 6%, transparent)"
            : undefined,
        opacity: isExcluded && !checked ? 0.55 : 1,
      }}
    >
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="rounded focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          style={{ accentColor: "var(--color-accent)" }}
        />
      </td>
      <td className="max-w-xs px-3 py-2 font-medium" style={{ color: "var(--color-text)" }}>
        <span className="block truncate">{item.name}</span>
      </td>
      <td className="truncate px-3 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
        {domain}
      </td>
      <td className="px-3 py-2 text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
        {item.date}
      </td>
      <td className="px-3 py-2">
        {isExcluded ? (
          <div className="flex items-center gap-1.5">
            <ExcludedBadge reason={item.excluded_reason!} />
            {onForceAdd && (
              <button
                onClick={onForceAdd}
                title="强制加入下载"
                className="opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: "var(--color-accent)" }}
              >
                <PlusCircle className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
            style={{
              background: "color-mix(in srgb, var(--color-success) 15%, transparent)",
              color: "var(--color-success)",
            }}
          >
            待下载
          </span>
        )}
      </td>
    </tr>
  );
});

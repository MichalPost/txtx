import { useEffect, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { animateStagger } from "@/lib/animations";
import type { WebsiteConfig } from "@/types";

import { SiteRuleCard } from "./SiteRuleCard";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SiteListProps {
  siteKeys: string[];
  websites: Record<string, WebsiteConfig>;
  getRuleStatus: (site: WebsiteConfig) => { filled: number; total: number; complete: boolean };
  recentlySavedKey: string | null;
  onEdit: (key: string) => void;
  onToggle: (key: string) => void;
  onDelete: (key: string) => void;
  onQuickSave: (key: string, patch: Partial<WebsiteConfig>) => void;
  onReorder: (orderedKeys: string[]) => void;
  onDuplicate: (key: string) => void;
}

// ─── SortableSiteRow ──────────────────────────────────────────────────────────

function SortableSiteRow({
  id,
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
  id: string;
  siteKey: string;
  site: WebsiteConfig;
  status: { filled: number; total: number; complete: boolean };
  highlighted?: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onQuickSave: (patch: Partial<WebsiteConfig>) => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
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
        dragHandle={<GripVertical className="h-4 w-4" {...attributes} {...listeners} />}
      />
    </div>
  );
}

// ─── SiteList ─────────────────────────────────────────────────────────────────

export function SiteList({
  siteKeys,
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

  // Internal ordered keys — keeps drag order independent of prop order
  const [localKeys, setLocalKeys] = useState<string[]>(() => siteKeys);

  // Sync when external siteKeys change: preserve existing order, append new, drop removed
  useEffect(() => {
    setLocalKeys((prev) => {
      const synced = prev.filter((k) => siteKeys.includes(k));
      const added = siteKeys.filter((k) => !prev.includes(k));
      return [...synced, ...added];
    });
  }, [siteKeys]);

  // Stagger animation when count changes (skip during drag to avoid conflicts)
  useEffect(() => {
    if (!listRef.current) return;
    const rows = listRef.current.querySelectorAll<HTMLElement>("[data-row]");
    if (rows.length) animateStagger(rows, 50);
  }, [siteKeys.length]);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = localKeys.indexOf(String(active.id));
    const newIdx = localKeys.indexOf(String(over.id));
    const reordered = arrayMove(localKeys, oldIdx, newIdx);
    setLocalKeys(reordered);
    onReorder(reordered);
  };

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
          className="rounded-full px-2 py-0.5 text-xs"
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
          }}
        >
          {siteKeys.length}
        </span>
      </div>

      {/* Sortable rows */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={localKeys} strategy={verticalListSortingStrategy}>
          <div ref={listRef} className="flex flex-col gap-2">
            {localKeys.map((key) => {
              const site = websites[key];
              if (!site) return null;
              const status = getRuleStatus(site);
              return (
                <SortableSiteRow
                  key={key}
                  id={key}
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
        </SortableContext>
      </DndContext>
    </div>
  );
}

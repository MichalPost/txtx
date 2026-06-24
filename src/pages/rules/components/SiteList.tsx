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

interface SiteListProps {
  siteKeys: string[];
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
  onQuickSave: (patch: Partial<WebsiteConfig>) => void | Promise<void>;
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
        dragHandle={
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors focus:outline-none focus-visible:ring-2"
            style={{
              color: "var(--color-text-subtle)",
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              cursor: "grab",
            }}
            title={`拖拽排序 ${siteKey}`}
            aria-label={`拖拽排序规则 ${siteKey}。按空格键开始键盘拖拽，再用方向键调整顺序。`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        }
      />
    </div>
  );
}

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
  const [localKeys, setLocalKeys] = useState<string[]>(() => siteKeys);

  useEffect(() => {
    setLocalKeys((prev) => {
      const synced = prev.filter((key) => siteKeys.includes(key));
      const added = siteKeys.filter((key) => !prev.includes(key));
      return [...synced, ...added];
    });
  }, [siteKeys]);

  useEffect(() => {
    if (!listRef.current) return;
    const rows = listRef.current.querySelectorAll<HTMLElement>("[data-row]");
    if (rows.length) animateStagger(rows, 50);
  }, [siteKeys.length]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localKeys.indexOf(String(active.id));
    const newIndex = localKeys.indexOf(String(over.id));
    const reordered = arrayMove(localKeys, oldIndex, newIndex);
    setLocalKeys(reordered);
    onReorder(reordered);
  };

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
            可拖拽左侧手柄调整优先级，也支持键盘：聚焦手柄后按空格开始，再用方向键排序。
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
          {siteKeys.length}
        </span>
      </div>

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

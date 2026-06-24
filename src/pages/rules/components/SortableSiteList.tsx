import { useEffect, useState } from "react";
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

import type { WebsiteConfig } from "@/types";

import { SiteRuleCard } from "./SiteRuleCard";

interface SortableSiteListProps {
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

export function SortableSiteList({
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
}: SortableSiteListProps) {
  const [localKeys, setLocalKeys] = useState<string[]>(() => siteKeys);

  useEffect(() => {
    setLocalKeys(siteKeys);
  }, [siteKeys]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localKeys.indexOf(String(active.id));
    const newIndex = localKeys.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(localKeys, oldIndex, newIndex);
    setLocalKeys(reordered);
    onReorder(reordered);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={localKeys} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
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
  );
}

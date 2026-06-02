import { useState, useCallback } from "react";
import type React from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Save, GripVertical } from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useConfigStore } from "@/store/configStore";
import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Input";
import { Toggle } from "@/components/Toggle";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import type { WebsiteConfig } from "@/types";

const defaultWebsite: WebsiteConfig = {
  enabled: true,
  domain_name: "https://",
  release_date: "",
  release_url: "",
  list_novel_name: "",
  novel_content: "",
  novel_name_x: "",
  chapter_url_x: "",
  page_list: ["/tongren"],
  special_mode: "normal",
  novel_content_fallbacks: [],
};

// ─── WebsiteEditor ─────────────────────────────────────────────────────────────

function WebsiteEditor({
  siteKey, site, onChange, onDelete, dragHandle,
}: {
  siteKey: string; site: WebsiteConfig;
  onChange: (s: WebsiteConfig) => void;
  onDelete: () => void;
  dragHandle?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  const field = (key: keyof WebsiteConfig, label: string, placeholder?: string) => (
    <Input
      label={label}
      value={site[key] as string}
      placeholder={placeholder}
      onChange={(e) => onChange({ ...site, [key]: e.target.value })}
    />
  );

  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${expanded ? "rounded-t-xl" : "rounded-xl"}`}
        style={{ background: "var(--color-surface-2)" }}
        onClick={() => setExpanded((v) => !v)}
      >
        {dragHandle && (
          <span onClick={e => e.stopPropagation()} className="cursor-grab active:cursor-grabbing shrink-0"
            style={{ color: "var(--color-text-subtle)" }}>
            {dragHandle}
          </span>
        )}
        {expanded
          ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
          : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />}
        <Toggle
          checked={site.enabled}
          onChange={(v) => onChange({ ...site, enabled: v })}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        />
        <span className="flex-1 text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
          {siteKey} — {site.domain_name}
        </span>
        {/* Priority badge */}
        <span className="text-xs px-2 py-0.5 rounded-full border tabular-nums"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
          拖拽排序
        </span>
        <Button
          variant="ghost" size="sm"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{ color: "var(--color-danger)" }}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {expanded && (
        <div className="p-4 grid grid-cols-2 gap-4 rounded-b-xl"
          style={{ background: "var(--color-surface)" }}>
          {field("domain_name", "域名", "https://example.com")}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>下载模式</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
              value={site.special_mode ?? "normal"}
              onChange={(e) => onChange({ ...site, special_mode: e.target.value })}>
              <option value="normal">通用模式</option>
              <option value="ttks">TTKS 专用（随机延迟 + UA 轮换）</option>
            </select>
          </div>
          {field("list_novel_name", "列表页书名 XPath")}
          {field("release_date", "发布日期 XPath")}
          {field("release_url", "发布链接 XPath")}
          {field("novel_name_x", "详情页书名 XPath")}
          {field("chapter_url_x", "章节链接 XPath")}
          {field("novel_content", "章节内容 XPath（主规则）")}
          <div className="col-span-2">
            <Textarea
              label="内容 XPath 备用规则（每行一条）"
              rows={3}
              value={(site.novel_content_fallbacks ?? []).join("\n")}
              onChange={(e) => onChange({
                ...site,
                novel_content_fallbacks: e.target.value.split("\n").map(l => l.trim()).filter(Boolean),
              })}
            />
          </div>
          <div className="col-span-2">
            <Textarea
              label="页面列表（每行一个路径）"
              rows={6}
              value={site.page_list.join("\n")}
              onChange={(e) => onChange({
                ...site,
                page_list: e.target.value.split("\n").map(l => l.trim()).filter(Boolean),
              })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SortableWebsiteItem ───────────────────────────────────────────────────────

function SortableWebsiteItem({
  id, siteKey, site, onChange, onDelete,
}: {
  id: string; siteKey: string; site: WebsiteConfig;
  onChange: (s: WebsiteConfig) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <WebsiteEditor
        siteKey={siteKey} site={site} onChange={onChange} onDelete={onDelete}
        dragHandle={<GripVertical className="w-4 h-4" {...attributes} {...listeners} />}
      />
    </div>
  );
}

// ─── WebsitesPage ──────────────────────────────────────────────────────────────

export function WebsitesPage() {
  const { config, saveConfig, saving } = useConfigStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!config) return <div className="p-5" style={{ color: "var(--color-text-muted)" }}>配置加载中...</div>;

  const websites = config.websites;
  // Maintain ordered keys so drag-reorder works
  const [orderedKeys, setOrderedKeys] = useState<string[]>(() => Object.keys(websites));

  // Sync orderedKeys when config changes externally
  const syncedKeys = orderedKeys.filter(k => k in websites);
  const newKeys = Object.keys(websites).filter(k => !orderedKeys.includes(k));
  const effectiveKeys = [...syncedKeys, ...newKeys];

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = effectiveKeys.indexOf(String(active.id));
    const newIdx = effectiveKeys.indexOf(String(over.id));
    const reordered = arrayMove(effectiveKeys, oldIdx, newIdx);
    setOrderedKeys(reordered);

    // Rebuild site_priority from new order
    const updatedPriority: Record<string, number> = {};
    reordered.forEach((key, idx) => {
      const domain = websites[key]?.domain_name;
      if (domain) updatedPriority[domain] = idx + 1;
    });
    saveConfig({
      ...config,
      filtering: { ...config.filtering, site_priority: updatedPriority },
    });
  }, [effectiveKeys, websites, config, saveConfig]);

  const addSite = () => {
    const key = `web${Object.keys(websites).length + 1}`;
    const newConfig = { ...config, websites: { ...websites, [key]: { ...defaultWebsite } } };
    setOrderedKeys(prev => [...prev, key]);
    saveConfig(newConfig);
  };

  const updateSite = (key: string, site: WebsiteConfig) => {
    saveConfig({ ...config, websites: { ...websites, [key]: site } });
  };

  const deleteSite = (key: string) => {
    const updated = { ...websites };
    delete updated[key];
    setOrderedKeys(prev => prev.filter(k => k !== key));
    saveConfig({ ...config, websites: updated });
  };

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">
      <PageHeader
        title="网站配置"
        subtitle="拖拽行首图标调整站点优先级，顺序即为 site_priority"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={addSite}>
              <Plus className="w-3.5 h-3.5" /> 添加站点
            </Button>
            <Button size="sm" onClick={() => saveConfig(config)} disabled={saving}>
              <Save className="w-3.5 h-3.5" /> {saving ? "保存中..." : "保存"}
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto pr-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={effectiveKeys} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {effectiveKeys.map(key => (
                <SortableWebsiteItem
                  key={key} id={key} siteKey={key}
                  site={websites[key]}
                  onChange={(s) => updateSite(key, s)}
                  onDelete={() => deleteSite(key)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {effectiveKeys.length === 0 && (
          <Card>
            <p className="text-center text-sm py-8" style={{ color: "var(--color-text-muted)" }}>
              暂无站点配置，点击「添加站点」开始
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

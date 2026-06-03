import { useState, useCallback, useMemo } from "react";
import type React from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Save, GripVertical, Upload, FileDown, Wand2, Code2, Sparkles, ListChecks, Globe } from "lucide-react";
import { SourceViewer } from "@/components/SourceViewer";
import { toast } from "sonner";
import { apiSaveTextFile } from "@/lib/api";
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
import { PageHeader } from "@/components/PageHeader";
import { RuleTemplateSelector } from "@/components/RuleTemplateSelector";
import { AiXPathAnalyzer } from "@/components/AiXPathAnalyzer";
import { RuleWizard } from "@/components/rule-wizard/RuleWizard";
import { useAiStore } from "@/store/aiStore";
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
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSourceViewer, setShowSourceViewer] = useState(false);
  const [showAiAnalyzer, setShowAiAnalyzer] = useState(false);
  const [showRuleWizard, setShowRuleWizard] = useState(false);
  const { config: aiConfig } = useAiStore();

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
          {/* Rule template selector */}
          <div className="col-span-2">
            {!showTemplates ? (
              <div className="flex gap-2 flex-wrap">
                <button
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                  style={{
                    background: "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))",
                    borderColor: "color-mix(in srgb, var(--color-accent) 30%, transparent)",
                    color: "var(--color-accent)",
                  }}
                  onClick={() => setShowTemplates(true)}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  套用规则模板
                </button>
                <button
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                  style={{
                    background: "var(--color-surface-1)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-muted)",
                  }}
                  onClick={() => setShowSourceViewer(true)}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  源码查看器
                </button>
                {aiConfig.enabled && (
                  <button
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                    style={{
                      background: "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))",
                      borderColor: "color-mix(in srgb, var(--color-accent) 30%, transparent)",
                      color: "var(--color-accent)",
                    }}
                    onClick={() => setShowAiAnalyzer((v) => !v)}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI 分析此站点
                  </button>
                )}
                <button
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                  style={{
                    background: showRuleWizard
                      ? "color-mix(in srgb, var(--color-accent) 15%, var(--color-surface))"
                      : "var(--color-surface-1)",
                    borderColor: showRuleWizard
                      ? "color-mix(in srgb, var(--color-accent) 50%, transparent)"
                      : "var(--color-border)",
                    color: showRuleWizard ? "var(--color-accent)" : "var(--color-text-muted)",
                  }}
                  onClick={() => {
                    setShowRuleWizard((v) => !v);
                    if (showAiAnalyzer) setShowAiAnalyzer(false);
                    if (showTemplates) setShowTemplates(false);
                  }}
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  规则向导
                </button>
              </div>            ) : (
              <RuleTemplateSelector
                onApply={(patch) => onChange({ ...site, ...patch })}
                onClose={() => setShowTemplates(false)}
              />
            )}
          </div>
          {showAiAnalyzer && (
            <div className="col-span-2">
              <AiXPathAnalyzer
                site={site}
                onApply={(patch) => onChange({ ...site, ...patch })}
                onClose={() => setShowAiAnalyzer(false)}
              />
            </div>
          )}
          {showRuleWizard && (
            <div className="col-span-2">
              <RuleWizard
                site={site}
                onApply={(patch) => onChange({ ...site, ...patch })}
                onClose={() => setShowRuleWizard(false)}
              />
            </div>
          )}
          {field("domain_name", "域名", "https://example.com")}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>下载模式</label>
            <select
              className="border rounded-[10px] px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] transition-colors cursor-pointer"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
              value={site.special_mode ?? "normal"}
              onChange={(e) => onChange({ ...site, special_mode: e.target.value })}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-accent)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
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
      {showSourceViewer && (
        <SourceViewer
          defaultUrl={site.domain_name}
          onXPathSelect={(xpath, field) => {
            onChange({ ...site, [field]: xpath });
          }}
          onClose={() => setShowSourceViewer(false)}
        />
      )}
    </div>
  );
}

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

  // Maintain ordered keys so drag-reorder works — must be declared before early return
  const [orderedKeys, setOrderedKeys] = useState<string[]>(() =>
    config ? Object.keys(config.websites) : []
  );

  // Sync orderedKeys when config changes externally
  const websites = useMemo(() => config?.websites ?? {}, [config]);
  const effectiveKeys = useMemo(() => {
    const synced = orderedKeys.filter(k => k in websites);
    const added = Object.keys(websites).filter(k => !orderedKeys.includes(k));
    return [...synced, ...added];
  }, [orderedKeys, websites]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (!config) return;
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
    }, true); // silent — drag reorder auto-saves without toast
  }, [effectiveKeys, websites, config, saveConfig]);

  if (!config) return <div className="p-5" style={{ color: "var(--color-text-muted)" }}>正在加载...</div>;

  const addSite = () => {
    const key = `web${Object.keys(websites).length + 1}`;
    const newConfig = { ...config, websites: { ...websites, [key]: { ...defaultWebsite } } };
    setOrderedKeys(prev => [...prev, key]);
    saveConfig(newConfig, true); // silent — user will edit and then click Save
  };

  const handleExport = async () => {
    try {
      const data = JSON.stringify(config.websites, null, 2);
      await apiSaveTextFile("websites-config.json", data);
      toast.success(`已导出 ${Object.keys(config.websites).length} 个站点配置`);
    } catch (e) {
      toast.error(`导出失败：${String(e)}`);
    }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text) as Record<string, WebsiteConfig>;
        const keys = Object.keys(imported);
        if (keys.length === 0) throw new Error("文件中没有站点配置");
        const firstVal = imported[keys[0]];
        if (!firstVal || typeof firstVal.domain_name === "undefined") {
          throw new Error("格式不正确，请确认是从本工具导出的配置文件");
        }
        const merged = { ...config.websites, ...imported };
        setOrderedKeys(prev => {
          const newKeys = keys.filter(k => !prev.includes(k));
          return [...prev, ...newKeys];
        });
        await saveConfig({ ...config, websites: merged }, true); // silent — we show our own toast below
        toast.success(`已导入 ${keys.length} 个站点（${Object.keys(config.websites).length} 个已有站点保留）`);
      } catch (e) {
        toast.error(`导入失败：${String(e)}`);
      }
    };
    input.click();
  };

  const updateSite = (key: string, site: WebsiteConfig) => {
    saveConfig({ ...config, websites: { ...websites, [key]: site } }, true); // silent — auto-saves on field change
  };

  const deleteSite = (key: string) => {
    const updated = { ...websites };
    delete updated[key];
    setOrderedKeys(prev => prev.filter(k => k !== key));
    saveConfig({ ...config, websites: updated }, true); // silent
  };

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">
      <PageHeader
        title="网站配置"
        subtitle="拖拽行首图标调整站点优先级，顺序即为 site_priority"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleImport}>
              <Upload className="w-3.5 h-3.5" /> 导入
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <FileDown className="w-3.5 h-3.5" /> 导出
            </Button>
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
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "var(--color-accent-muted)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
                boxShadow: "var(--shadow-accent)",
              }}
            >
              <Globe className="w-8 h-8" style={{ color: "var(--color-accent)" }} />
            </div>
            <div className="text-center">
              <p className="font-semibold" style={{ color: "var(--color-text)", fontSize: "var(--text-lg)" }}>
                还没有站点
              </p>
              <p className="text-sm mt-1.5" style={{ color: "var(--color-text-muted)" }}>
                添加一个站点，配置好规则就能开始下载
              </p>
            </div>
            <Button size="sm" onClick={addSite}>
              <Plus className="w-3.5 h-3.5" /> 添加站点
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
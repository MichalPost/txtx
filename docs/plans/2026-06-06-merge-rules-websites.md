# 规则配置 + 站点配置合并 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `/websites`（网站配置）与 `/rules`（规则管理）合并为一个统一的站点管理页，消除功能重叠，补充复制规则能力。

**Architecture:** 以 `/rules` 为主体，将 `/websites` 的高级功能（拖拽排序、导入/导出、规则模板、AI 分析、源码查看器）逐步搬入，最终删除 `WebsitesPage` 并将 `/websites` 路由重定向。`useRulesPageActions` 扩充新 action，`SiteRuleCard` 增加工具栏和复制按钮，`SiteList` 接入 `@dnd-kit` 支持拖拽排序。

**Tech Stack:** React 18, TypeScript, Zustand, @dnd-kit/core + @dnd-kit/sortable, lucide-react

---

## Task 1: 给 `useRulesPageActions` 添加 `duplicateSite` + `reorderSites`

**Files:**
- Modify: `src/pages/rules/useRulesPageActions.ts`

两个新 action：
- `duplicateSite(key)` — 复制一个站点规则，新 key = `${key}_copy`（自动递增避免冲突），domain_name 清空（防重复域名检测），其他字段保留，直接打开向导编辑。
- `reorderSites(orderedKeys)` — 按新顺序重建 `filtering.site_priority`，silent save。

```ts
// 在 useRulesPageActions 里新增：

const duplicateSite = (key: string) => {
  if (!config) return;
  const base = config.websites[key];
  if (!base) return;

  // 生成不重复的新 key
  const existingKeys = Object.keys(config.websites);
  let newKey = `${key}_copy`;
  let i = 2;
  while (existingKeys.includes(newKey)) {
    newKey = `${key}_copy${i}`;
    i++;
  }

  // domain_name 清空，其他规则保留
  const newSite: WebsiteConfig = { ...base, domain_name: "https://", enabled: true };
  saveConfig(
    { ...config, websites: { ...config.websites, [newKey]: newSite } },
    true, // silent
  );
  setEditingKey(newKey); // 直接进向导
};

const reorderSites = (orderedKeys: string[]) => {
  if (!config) return;
  const updatedPriority: Record<string, number> = {};
  orderedKeys.forEach((key, idx) => {
    const domain = config.websites[key]?.domain_name;
    if (domain) updatedPriority[domain] = idx + 1;
  });
  saveConfig(
    {
      ...config,
      filtering: { ...config.filtering, site_priority: updatedPriority },
    },
    true,
  );
};
```

返回值里暴露这两个函数。

---

## Task 2: `SiteRuleCard` 增加"复制"按钮 + 高级工具栏（模板/AI/源码查看）

**Files:**
- Modify: `src/pages/rules/components/SiteRuleCard.tsx`

### 2a — 复制按钮

在 Actions 区的"编辑"按钮旁加一个 `Copy` 图标按钮（`lucide-react` 的 `Copy` 图标），调用新传入的 `onDuplicate` prop。

### 2b — 高级工具栏

在 expanded 快速编辑面板下方新增一排工具按钮（与 `/websites` 保持一致的视觉风格）：

```tsx
// 新增 props
onDuplicate: () => void;
```

工具栏按钮（折叠时不显示，仅在 `expanded` 展开时呈现在快速编辑面板最下方）：
- **套用规则模板** — 点击后 inline 展示 `<RuleTemplateSelector>`
- **AI 分析** — 仅当 `aiEnabled` 时出现，展示 `<AiXPathAnalyzer>`  
- **源码查看器** — 展示 `<SourceViewer>`

这三个面板为互斥展示（打开一个时关闭另外两个），用一个 `activePanel: "template" | "ai" | "source" | null` state 管理。

`RuleTemplateSelector.onApply` 和 `AiXPathAnalyzer.onApply` 的结果通过 `onQuickSave(patch)` 保存（调用现有的 `quickSave` 即可）。`SourceViewer.onXPathSelect` 需要能更新单个 XPath 字段，直接用 `onQuickSave({ [field]: xpath })` 映射即可（`SourceViewer` 的 `onXPathSelect(xpath, field)` 中 `field` 是 `keyof WebsiteConfig`）。

完整按钮代码示意（放在展开面板 `expanded && (...)` 底部的 `border-t` 分隔线之后）：

```tsx
{expanded && (
  <div className="mt-2 flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
    <ToolBtn
      active={activePanel === "template"}
      onClick={() => setActivePanel(p => p === "template" ? null : "template")}
      icon={<Wand2 className="w-3 h-3" />}
      label="规则模板"
    />
    {aiEnabled && (
      <ToolBtn
        active={activePanel === "ai"}
        onClick={() => setActivePanel(p => p === "ai" ? null : "ai")}
        icon={<Sparkles className="w-3 h-3" />}
        label="AI 分析"
      />
    )}
    <ToolBtn
      active={activePanel === "source"}
      onClick={() => setActivePanel(p => p === "source" ? null : "source")}
      icon={<Code2 className="w-3 h-3" />}
      label="源码查看器"
    />
    {/* Panel content */}
    {activePanel === "template" && (
      <div className="w-full">
        <RuleTemplateSelector
          onApply={(patch) => { onQuickSave(patch); setActivePanel(null); }}
          onClose={() => setActivePanel(null)}
        />
      </div>
    )}
    {activePanel === "ai" && (
      <div className="w-full">
        <AiXPathAnalyzer
          site={site}
          onApply={(patch) => { onQuickSave(patch); setActivePanel(null); }}
          onClose={() => setActivePanel(null)}
        />
      </div>
    )}
    {activePanel === "source" && (
      <div className="w-full">
        <SourceViewer
          defaultUrl={site.domain_name}
          onXPathSelect={(xpath, field) => onQuickSave({ [field]: xpath })}
          onClose={() => setActivePanel(null)}
        />
      </div>
    )}
  </div>
)}
```

`ToolBtn` 是一个本地小组件（与 `ActionButton` 类似的内联样式按钮，active 时高亮 accent 颜色）。

---

## Task 3: `SiteList` 接入 `@dnd-kit` 支持拖拽排序

**Files:**
- Modify: `src/pages/rules/components/SiteList.tsx`

新增 prop：`onReorder: (orderedKeys: string[]) => void`

```tsx
// 新 props
interface SiteListProps {
  // ... 原有字段不变
  onReorder: (orderedKeys: string[]) => void;
  onDuplicate: (key: string) => void;
}
```

内部维护 `localKeys` state（同 `/websites` 的 `orderedKeys` 逻辑）。使用 `@dnd-kit/core` 的 `DndContext` + `@dnd-kit/sortable` 的 `SortableContext` + `useSortable`，在 `onDragEnd` 时用 `arrayMove` 更新 `localKeys` 并调用 `onReorder`。

每行用 `SortableSiteRow` wrapper 包一层（同 `/websites` 的 `SortableWebsiteItem` 模式），注入 `GripVertical` 拖把手到 `SiteRuleCard` 的 `dragHandle` prop（SiteRuleCard 需同步添加可选 `dragHandle?: React.ReactNode`，显示在 Globe 图标左侧）。

`localKeys` 要随外部 `siteKeys` prop 变化同步（新增/删除时合并）：

```tsx
const [localKeys, setLocalKeys] = useState(siteKeys);
useEffect(() => {
  setLocalKeys(prev => {
    const synced = prev.filter(k => siteKeys.includes(k));
    const added = siteKeys.filter(k => !prev.includes(k));
    return [...synced, ...added];
  });
}, [siteKeys]);
```

---

## Task 4: `RulesPage` 添加导入/导出 + 接入新 actions

**Files:**
- Modify: `src/pages/rules/RulesPage.tsx`
- Modify: `src/pages/rules/useRulesPageActions.ts`（在 Task 1 基础上补充 import/export）

### 4a — `useRulesPageActions` 补充 `exportSites` / `importSites`

直接把 `/websites` 的逻辑搬过来：

```ts
const exportSites = async () => {
  if (!config) return;
  try {
    const { apiSaveTextFile } = await import("@/lib/api");
    const data = JSON.stringify(config.websites, null, 2);
    await apiSaveTextFile("websites-config.json", data);
    toast.success(`已导出 ${Object.keys(config.websites).length} 个站点配置`);
  } catch (e) {
    toast.error(`导出失败：${String(e)}`);
  }
};

const importSites = () => {
  if (!config) return;
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
      await saveConfig({ ...config, websites: merged }, true);
      toast.success(`已导入 ${keys.length} 个站点`);
    } catch (e) {
      toast.error(`导入失败：${String(e)}`);
    }
  };
  input.click();
};
```

### 4b — `RulesPage` 页头加按钮

在列表视图（`!editingKey`）的 `PageHeader` actions 中加入：

```tsx
// 非编辑状态的 actions
actions={
  editingKey ? (
    <Button variant="secondary" size="sm" onClick={handleWizardClose}>
      <ChevronLeft className="w-3.5 h-3.5" />
      返回列表
    </Button>
  ) : (
    <>
      <Button variant="secondary" size="sm" onClick={importSites}>
        <Upload className="w-3.5 h-3.5" />
        导入
      </Button>
      <Button variant="secondary" size="sm" onClick={exportSites}>
        <FileDown className="w-3.5 h-3.5" />
        导出
      </Button>
      <Button size="sm" onClick={handleNewSite} disabled={saving}>
        <Plus className="w-3.5 h-3.5" />
        新建规则
      </Button>
    </>
  )
}
```

### 4c — `RulesPage` 传入新 props 给 `SiteList`

```tsx
<SiteList
  // ...原有 props
  onReorder={reorderSites}
  onDuplicate={duplicateSite}
/>
```

`SiteList` 向下传 `onDuplicate` 到每个 `SiteRuleCard`。

---

## Task 5: 删除 `WebsitesPage`，路由重定向

**Files:**
- Modify: `src/router.tsx`
- Modify: `src/components/Sidebar.tsx`
- Delete: `src/pages/WebsitesPage.tsx`（最后执行，确认没有其他 import 再删）

### 5a — `router.tsx` 

移除 `WebsitesPage` 的 lazy import，把 `/websites` 路由改为重定向到 `/rules`：

```tsx
// 删除：
// const WebsitesPage = lazy(...)

// 修改路由配置：
{ path: "websites", element: <Navigate to="/rules" replace /> },
```

需要 import `Navigate` from `react-router-dom`。

同时删除 `ROUTES` 里的 `websites` 条目，并更新 `AppRoute` 类型：

```ts
export const ROUTES = {
  home:       "/",
  tasks:      "/tasks",
  rules:      "/rules",    // 原来的 /websites 并入
  settings:   "/settings",
  filter:     "/filter",
  history:    "/history",
  health:     "/health",
  converter:  "/converter",
  bookshelf:  "/bookshelf",
} as const;
```

### 5b — `Sidebar.tsx`

从 `navItems` 里删除 `{ to: "/websites", ... }` 那一行，并删除 `Globe` icon 的 import（如果没有其他地方用到）。

### 5c — 删除 `WebsitesPage.tsx`

```
del src\pages\WebsitesPage.tsx
```

确认无其他文件 import 它之后再删。

---

## Task 6: 验证构建

```bash
pnpm run build
```

预期：零 TypeScript 错误，零未解析 import，dist 产出正常。

如有 lint 错误，修复后重新构建。

---

## 变更汇总

| 文件 | 操作 |
|------|------|
| `src/pages/rules/useRulesPageActions.ts` | 添加 `duplicateSite`, `reorderSites`, `exportSites`, `importSites` |
| `src/pages/rules/components/SiteRuleCard.tsx` | 添加 `onDuplicate` prop + 复制按钮 + `dragHandle` prop + 工具栏（模板/AI/源码）|
| `src/pages/rules/components/SiteList.tsx` | 接入 dnd-kit 拖拽 + 新 props |
| `src/pages/rules/RulesPage.tsx` | 添加导入/导出按钮 + 传入新 props |
| `src/router.tsx` | 删除 `/websites` 路由，改为重定向 + 删除 `ROUTES.websites` |
| `src/components/Sidebar.tsx` | 删除"网站配置"导航项 |
| `src/pages/WebsitesPage.tsx` | **删除** |

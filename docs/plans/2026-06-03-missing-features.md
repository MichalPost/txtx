# Missing Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现4个缺失功能：源代码查看器（含XPath辅助）、网站配置导入/导出、任务文件导入、快速规则套用向导。

**Architecture:** 全部为纯前端实现，复用现有组件体系（Card/Button/Input/Textarea）和设计系统。网站配置导入导出通过浏览器File API实现。源代码查看器内嵌在WebsitesPage内，通过fetch URL获取HTML源码并高亮展示。任务导入在DownloadPage/TaskManagerPage新增入口。

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS, lucide-react, 现有设计Token（无需新依赖）

---

## Task 1: 网站配置导入/导出

**Files:**
- Modify: `src/pages/WebsitesPage.tsx`
- Modify: `src/lib/api/files.ts`（新增saveFile辅助）

### Step 1: 在 `src/lib/api/files.ts` 添加 saveTextFile 辅助函数

添加到文件末尾：

```typescript
/** Save text content as a download in browser, or write to path in Tauri */
export async function apiSaveTextFile(filename: string, content: string): Promise<void> {
  if (IS_TAURI) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: filename, filters: [{ name: "JSON", extensions: ["json"] }] });
    if (path) await writeTextFile(path, content);
    return;
  }
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
```

### Step 2: 在 WebsitesPage.tsx 添加导出按钮和导入逻辑

在 `WebsitesPage` 的 `PageHeader` actions 中，在"添加站点"按钮前增加"导入"和"导出"两个按钮：

导出逻辑（点击导出当前所有网站配置为JSON）：
```typescript
const handleExport = async () => {
  const data = JSON.stringify(config.websites, null, 2);
  await apiSaveTextFile("websites-config.json", data);
  toast.success("网站配置已导出");
};
```

导入逻辑（读取JSON文件，合并到现有配置）：
```typescript
const handleImport = async () => {
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".json";
  input.onchange = async () => {
    const file = input.files?.[0]; if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text) as Record<string, WebsiteConfig>;
      const merged = { ...config.websites, ...imported };
      setOrderedKeys(prev => {
        const newKeys = Object.keys(imported).filter(k => !prev.includes(k));
        return [...prev, ...newKeys];
      });
      await saveConfig({ ...config, websites: merged });
      toast.success(`已导入 ${Object.keys(imported).length} 个站点`);
    } catch {
      toast.error("导入失败，请确认文件格式正确");
    }
  };
  input.click();
};
```

---

## Task 2: 源代码查看器 + XPath 生成工具

**Files:**
- Create: `src/components/SourceViewer.tsx`
- Modify: `src/pages/WebsitesPage.tsx`（在WebsiteEditor内集成入口按钮）
- Modify: `src/lib/api/files.ts`（新增 apiProxyFetch）

### Step 1: 添加代理fetch API

在非Tauri环境下，直接fetch第三方URL会有CORS问题，所以需要通过后端代理或在Tauri环境中直接调用invoke。

在 `src/lib/api/files.ts` 添加：

```typescript
/** Fetch raw HTML source of a URL via backend proxy (avoids CORS) */
export async function apiFetchSource(url: string): Promise<string> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("fetch_source", { url });
  }
  const res = await fetch(`${API_BASE}/api/source?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.html as string;
}
```

### Step 2: 创建 SourceViewer 组件

创建 `src/components/SourceViewer.tsx`，功能包括：
- 输入URL，点击"获取源码"
- 展示带行号的HTML源码（等宽字体）
- 搜索/高亮关键词
- 标签分段（折叠/展开特定标签）
- XPath生成工具：点击HTML元素自动生成XPath路径
- 一键复制XPath

核心结构：
```tsx
interface SourceViewerProps {
  defaultUrl?: string;
  onXPathSelect?: (xpath: string) => void;
  onClose?: () => void;
}

export function SourceViewer({ defaultUrl, onXPathSelect, onClose }: SourceViewerProps)
```

内部状态：
- `url`: 当前URL输入
- `html`: 获取到的源码
- `loading`: 加载状态
- `search`: 搜索关键词
- `parsedElements`: 解析后的HTML元素树（用于XPath生成）
- `hoveredPath`: 鼠标悬停的元素路径
- `generatedXPath`: 当前生成的XPath
- `activeTab`: "source" | "tree"（源码视图/树形视图）

XPath生成算法：
```typescript
function buildXPath(element: Element): string {
  const parts: string[] = [];
  let el: Element | null = element;
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let idx = 1;
    let sibling = el.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === el.tagName) idx++;
      sibling = sibling.previousElementSibling;
    }
    const tag = el.tagName.toLowerCase();
    const id = el.getAttribute("id");
    const cls = el.getAttribute("class")?.split(" ").filter(Boolean)[0];
    if (id) { parts.unshift(`//${tag}[@id="${id}"]`); break; }
    else if (cls) parts.unshift(`${tag}[@class="${cls}"]`);
    else parts.unshift(`${tag}[${idx}]`);
    el = el.parentElement;
  }
  return "/" + parts.join("/");
}
```

### Step 3: 在 WebsiteEditor 中集成源代码查看器

在 `WebsiteEditor` 的展开内容底部添加"打开源码查看器"按钮：
- 点击弹出全屏遮罩层（overlay），内嵌 `<SourceViewer>`
- 将域名 URL 作为 `defaultUrl` 传入
- `onXPathSelect` 回调：将生成的XPath填入对应输入框（弹出选择菜单让用户选"填入哪个字段"）

---

## Task 3: 任务文件导入（TXT/CSV）

**Files:**
- Create: `src/components/download/ImportTaskDialog.tsx`
- Modify: `src/pages/DownloadPage.tsx`（添加导入入口）
- Modify: `src/pages/tasks/TaskListPanel.tsx`（也添加入口）

### Step 1: 创建 ImportTaskDialog 组件

功能：
- 支持两种输入方式：粘贴文本 / 选择文件（.txt / .csv）
- 从输入内容中提取URL（每行一个，自动过滤非URL行）
- 预览提取到的URL列表（书名预览用URL最后一段作为占位）
- 点击"开始下载"，将所有URL创建为单本任务或发起批量下载

URL提取逻辑：
```typescript
function extractUrls(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map(l => l.trim())
    .filter(l => /^https?:\/\/.+/.test(l));
}
```

对话框结构（非Modal，而是内嵌Panel）：
```tsx
export function ImportTaskDialog({ onClose, onImport }: {
  onClose: () => void;
  onImport: (urls: string[]) => void;
})
```

### Step 2: 在 DownloadPage 的 SingleDownloadInput 旁边添加导入按钮

在 `DownloadPage.tsx` 中，在 `SingleDownloadInput` 旁边添加一个 ghost 按钮"批量导入"，点击展开 `ImportTaskDialog`。

### Step 3: 在 TaskListPanel 添加导入入口

在任务列表的新建任务区域，添加"从文件导入"按钮，逻辑相同。

---

## Task 4: 快速规则套用向导

**Files:**
- Create: `src/components/RuleTemplateSelector.tsx`
- Modify: `src/pages/WebsitesPage.tsx`（在WebsiteEditor内集成）

### Step 1: 定义规则模板

创建内置规则模板列表（针对常见小说网站结构）：

```typescript
interface RuleTemplate {
  name: string;
  description: string;
  list_novel_name: string;
  release_date: string;
  release_url: string;
  novel_name_x: string;
  chapter_url_x: string;
  novel_content: string;
  novel_content_fallbacks: string[];
}

const RULE_TEMPLATES: RuleTemplate[] = [
  {
    name: "通用型（标准列表页）",
    description: "适合：列表页有标准 li/a 结构，章节内容在 div.content 类区域",
    list_novel_name: "//ul[@class='update-list']//li//a/text()",
    release_date: "//ul[@class='update-list']//li//span[@class='time']/text()",
    release_url: "//ul[@class='update-list']//li//a/@href",
    novel_name_x: "//h1[@class='bookname']/text()|//h1/text()",
    chapter_url_x: "//ul[@id='chapterlist']//li/a/@href|//div[@class='listmain']//a/@href",
    novel_content: "//div[@id='content']/text()|//div[@class='content']/text()",
    novel_content_fallbacks: ["//div[@id='booktxt']/text()", "//div[@class='box_con']/text()"],
  },
  {
    name: "最新更新页型",
    description: "适合：首页/最新更新页面，table 结构",
    list_novel_name: "//table[@class='grid']//td[@class='odd']/a/text()",
    release_date: "//table[@class='grid']//td[last()]/text()",
    release_url: "//table[@class='grid']//td[@class='odd']/a/@href",
    novel_name_x: "//div[@class='info']/h2/text()|//h1/text()",
    chapter_url_x: "//dl//dd/a/@href",
    novel_content: "//div[@id='content']/text()",
    novel_content_fallbacks: [],
  },
  {
    name: "分类页型（按类型浏览）",
    description: "适合：有书籍分类的站点，li.list-item 或 div.book-item 结构",
    list_novel_name: "//li[contains(@class,'list-item')]//p[@class='title']/a/text()",
    release_date: "//li[contains(@class,'list-item')]//p[@class='time']/text()",
    release_url: "//li[contains(@class,'list-item')]//p[@class='title']/a/@href",
    novel_name_x: "//h1/text()|//div[@class='title']/h1/text()",
    chapter_url_x: "//ul[@class='chapter-list']//li/a/@href",
    novel_content: "//div[@class='chapter-content']/text()|//article/text()",
    novel_content_fallbacks: ["//div[@id='content']/text()"],
  },
];
```

### Step 2: 创建 RuleTemplateSelector 组件

一个紧凑的下拉选择 + 预览区：

```tsx
export function RuleTemplateSelector({ onApply }: {
  onApply: (template: RuleTemplate) => void;
})
```

UI：
- 下拉列表展示模板名称和说明
- 选择后展示该模板所有规则字段的预览
- "套用此规则"按钮——回调 onApply，由父组件更新对应 WebsiteConfig 字段
- "关闭"按钮

### Step 3: 在 WebsiteEditor 集成模板选择器

在展开的编辑区顶部添加"套用规则模板"折叠区：
- 默认折叠
- 点击展开 RuleTemplateSelector
- 选择套用后自动填充所有规则字段，并折叠选择器

---

## 执行顺序

1. Task 1（网站配置导入/导出）— 最简单，先做
2. Task 4（快速规则套用向导）— 纯前端，无外部依赖
3. Task 3（任务文件导入）— 需要新组件
4. Task 2（源代码查看器）— 最复杂，最后做

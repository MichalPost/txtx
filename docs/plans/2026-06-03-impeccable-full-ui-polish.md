# txtx 前端全面 UI 优化计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 系统性修复所有设计规则违反、视觉层级问题、文案问题、交互一致性缺陷和可访问性漏洞，覆盖项目所有页面和核心组件。

**Architecture:** 按优先级分 4 个批次执行：批次1 修设计规则违反（必须修）；批次2 升级空状态和交互；批次3 全局文案替换；批次4 代码质量和可访问性。每个 task 改完立即可视觉验证。

**Tech Stack:** React 18 + TypeScript, Tailwind CSS v4, framer-motion, lucide-react, CSS custom properties (design tokens)

---

## 背景知识

### 设计系统规则（必读）
- **PRODUCT.md** — 产品定位：温暖、书卷气、私人图书馆助手。
- **DESIGN.md** — 完整设计系统。主题通过 `<html data-theme="...">` 切换，默认 `light`。
- **颜色全用 CSS custom property**，例如 `var(--color-accent)`，不用硬编码值。
- **禁止：** `border-left/right > 1px` 装饰条、渐变文字、玻璃拟态默认装饰、SaaS 英雄指标模板、相同尺寸卡片网格、Modal 作为第一反应、嵌套卡片。
- **文案规则：** 空状态必须有动词；不用"暂无数据"、"操作成功"等系统术语；不用 `—` 破折号；用自然口语。
- **按钮变体：** `primary` / `secondary` / `danger` / `ghost`，尺寸 `sm/md/lg`。

### 文件路径约定
所有路径相对于 `e:\Code\Web\txtx\`，即 workspace root。

### 如何验证
运行 `pnpm dev`，在浏览器中逐页检查。本项目无前端单测，靠视觉验证。

---

## 批次 1：设计规则违反（必须修）

### Task 1: 移除 Sidebar active 状态的 border-left 装饰条

**问题：** `Sidebar.tsx` 中 active navlink 使用了绝对定位的 `w-0.5 h-4` 左侧竖条，
语义等同于 `border-left` 装饰，违反 DESIGN.md anti-pattern。

**文件：**
- 修改: `src/components/Sidebar.tsx`

**改动：** 找到如下片段并删除整个 `{isActive && !collapsed && ...}` span：

```tsx
{/* Active left indicator bar */}
{isActive && !collapsed && (
  <span
    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
    style={{
      background: "var(--color-accent)",
      boxShadow: "0 0 5px var(--color-accent)",
    }}
  />
)}
```

删除后，active 态已有 `background: color-mix(in srgb, var(--color-accent) 12%, transparent)`
+ `color: var(--color-accent)` + `font-weight: 600`，视觉足够清晰，不需要竖条。

**验证：** 侧边栏导航，active 项无左侧光条，依然可识别。

---

### Task 2: 修复 DownloadPage subtitle 中的破折号

**问题：** `DownloadPage.tsx` subtitle 使用了 `"—"` 破折号，DESIGN.md 明确禁止。

**文件：**
- 修改: `src/pages/DownloadPage.tsx`

**改动：** 找到：

```tsx
subtitle={`保存目录：${config?.paths.base_dir ?? "—"}`}
```

改为：

```tsx
subtitle={config?.paths.base_dir ? `保存目录：${config.paths.base_dir}` : undefined}
```

无 config 时不显示 subtitle，而非显示一个破折号占位。

**验证：** 下载页 header 在有 config 时显示路径，无 config 时只有标题，不显示"—"。

---

### Task 3: 修复 historyColumns.tsx 中的备注破折号

**问题：** `historyColumns.tsx` 中备注列用 `"—"` 作为空值占位。

**文件：**
- 修改: `src/pages/history/historyColumns.tsx`

**改动：** 找到：

```tsx
{info.getValue() ?? "—"}
```

改为：

```tsx
{info.getValue() ?? ""}
```

空备注时直接留空，不显示破折号。同时把 cell 的 `title` 也改掉：

```tsx
title={info.getValue() ?? ""}
```

**验证：** 历史记录表格中备注列空值时不显示"—"。

---

### Task 4: 修复 BlacklistPage subtitle 中的破折号

**问题：** `BlacklistPage.tsx` subtitle 使用了 `—`（中文破折号 Unicode em dash）作为分隔符。

**文件：**
- 修改: `src/pages/blacklist/BlacklistPage.tsx`

**改动：** 找到：

```tsx
subtitle={`共 ${bl.keywords.length} 个关键词，${bl.regex_patterns.length} 个正则 — 支持模糊搜索`}
```

改为：

```tsx
subtitle={`共 ${bl.keywords.length} 个关键词，${bl.regex_patterns.length} 个正则，支持模糊搜索`}
```

用逗号替换破折号。

**验证：** 黑名单页面 header subtitle 无破折号。

---

### Task 5: Button 组件补充 focus-visible 样式

**问题：** `Button.tsx` 无 `:focus-visible` outline，键盘用户无法感知焦点，违反可访问性。

**文件：**
- 修改: `src/components/Button.tsx`

**改动：** 在 `className` 的 class 列表中加入：

```tsx
className={`
  inline-flex items-center gap-1.5 rounded-[10px] font-medium
  transition-all cursor-pointer
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-[var(--color-accent)]
  disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none
  active:scale-[0.97]
  ${sizeClasses[size]} ${className}
`}
```

两行新增：`focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2` 和 `focus-visible:outline-[var(--color-accent)]`。

**验证：** 用 Tab 键导航，聚焦到按钮时显示 accent 色 outline，不影响鼠标操作视觉。

---

### Task 6: Input / Textarea 补充 focus-visible 样式

**问题：** `Input.tsx` 的 focus 样式完全通过 `onFocus`/`onBlur` JS 操作 inline style，无法响应键盘 `:focus-visible`（实际上 focus ring 已通过 JS 触发，但语义不正确）。补充 CSS-side 的 `focus-visible` 作为无障碍保障。

**文件：**
- 修改: `src/components/Input.tsx`

**改动：** 在 `baseClass` 字符串中追加：

```ts
const baseClass =
  "w-full border rounded-[10px] px-3 py-2 text-sm focus:outline-none transition-colors placeholder:text-[var(--color-text-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1";
```

注意：`focus:outline-none` 保留（防止浏览器默认 outline 与 JS focus style 叠加），`focus-visible:ring-*` 为键盘用户提供明确 focus 指示。

**验证：** Tab 到输入框时显示 accent 色 ring，点击时正常（已通过 JS 触发 border + boxShadow）。

---

## 批次 2：空状态升级 + 交互修复

### Task 7: HealthPage 空状态升级

**问题：** 检查前只有一行文字，无视觉锚点，与其他页面的 empty state 规范不符。

**文件：**
- 修改: `src/pages/HealthPage.tsx`

**改动：** 将：

```tsx
{!isSuccess && !checking && (
  <div className="flex-1 flex items-center justify-center">
    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
      点击「开始检查」检测所有启用站点的连通性
    </p>
  </div>
)}
```

替换为符合 DESIGN.md empty state 规范的完整组件（图标容器 + 标题 + 说明）：

```tsx
{!isSuccess && !checking && (
  <div className="flex-1 flex flex-col items-center justify-center gap-4">
    <div
      className="w-16 h-16 rounded-2xl flex items-center justify-center"
      style={{
        background: "var(--color-accent-muted)",
        border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
        boxShadow: "var(--shadow-accent)",
      }}
    >
      <Activity className="w-8 h-8" style={{ color: "var(--color-accent)" }} />
    </div>
    <div className="text-center">
      <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
        还没有检查过
      </p>
      <p className="text-sm mt-1.5" style={{ color: "var(--color-text-muted)" }}>
        点击「开始检查」测试所有启用站点的连通性
      </p>
    </div>
  </div>
)}
```

**验证：** 健康检查页面初始状态有图标 + 标题 + 说明，与规则管理等页面的空状态风格一致。

---

### Task 8: HistoryPage 空状态升级 + 文案修复

**问题：** 空状态图标太小（w-8），无背景容器，"暂无历史记录"无动词。

**文件：**
- 修改: `src/pages/history/HistoryPage.tsx`

**改动：** 将表格内的空状态从：

```tsx
<div className="flex flex-col items-center justify-center h-full gap-2 py-16">
  <TableIcon className="w-8 h-8" style={{ color: "var(--color-text-subtle)" }} />
  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
    {isLoading ? "加载中..." : activeSearch ? "没有匹配的记录" : "暂无历史记录"}
  </p>
</div>
```

替换为：

```tsx
<div className="flex flex-col items-center justify-center h-full gap-4 py-16">
  {isLoading ? (
    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>加载中...</p>
  ) : activeSearch ? (
    <>
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
        }}
      >
        <Search className="w-7 h-7" style={{ color: "var(--color-text-subtle)" }} />
      </div>
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        没有匹配「{activeSearch}」的记录
      </p>
    </>
  ) : (
    <>
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{
          background: "var(--color-accent-muted)",
          border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
          boxShadow: "var(--shadow-accent)",
        }}
      >
        <TableIcon className="w-7 h-7" style={{ color: "var(--color-accent)" }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          还没有下载记录
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          下载完成后，记录会出现在这里
        </p>
      </div>
    </>
  )}
</div>
```

需要在文件顶部确认已 import `Search`（已有）。

**验证：** 历史页面空状态有图标容器 + 标题 + 说明；有搜索词时显示带搜索词的无结果提示。

---

### Task 9: ConverterPage 运行中占位区

**问题：** 转换进行中（`running === true`）右侧结果区完全空白，缺乏反馈。

**文件：**
- 修改: `src/pages/ConverterPage.tsx`

**改动：** 将结果 Card 的条件从 `results.length > 0` 改为 `results.length > 0 || running`，并在 running 时显示加载状态：

```tsx
{(results.length > 0 || running) && (
  <Card title="转换结果" className="w-80 shrink-0 flex flex-col min-h-0">
    <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
      {running && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{
              borderColor: "var(--color-border)",
              borderTopColor: "var(--color-accent)",
            }}
          />
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>转换中...</p>
        </div>
      )}
      {results.map((r, i) => (
        // ... 原有 result map 不变
      ))}
    </div>
  </Card>
)}
```

注意：要把 `Play` 图标 import 改成也 import `CheckCircle`（已有）。不需要新 import。

**验证：** 点击"开始转换"后右侧立即出现 Card 并显示转动圆圈，转换完成后显示结果列表。

---

### Task 10: HistoryPage 清空确认改为 inline 二次确认

**问题：** 用了浏览器原生 `confirm()`，无样式，与产品调性不符，且无法在 Tauri webview 中保证可用。

**文件：**
- 修改: `src/pages/history/HistoryPage.tsx`

**改动：** 在组件中添加状态：

```tsx
const [confirmingClear, setConfirmingClear] = useState(false);
```

将 header actions 中的清空按钮替换为：

```tsx
{confirmingClear ? (
  <div className="flex items-center gap-1.5">
    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>确认清空？</span>
    <Button
      variant="danger"
      size="sm"
      onClick={() => { setConfirmingClear(false); clearMutation.mutate(); }}
      disabled={clearMutation.isPending}
    >
      清空
    </Button>
    <Button variant="ghost" size="sm" onClick={() => setConfirmingClear(false)}>
      取消
    </Button>
  </div>
) : (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => setConfirmingClear(true)}
    disabled={total === 0 || clearMutation.isPending}
  >
    <Trash2 className="w-3.5 h-3.5" /> 清空
  </Button>
)}
```

同时删除旧的 `handleClear` 函数中的 `confirm()` 调用，或直接内联 `clearMutation.mutate()`。

**验证：** 点击"清空"按钮变为"确认清空？清空 / 取消"行内确认，不弹浏览器对话框。

---

### Task 11: FilterPage 移除冗余的 tab 描述行

**问题：** Tab 按钮下方有一行独立描述文字，切换时突然替换、有跳动感；按钮本身已经有 label + icon，描述多余。

**文件：**
- 修改: `src/pages/filter/FilterPage.tsx`

**改动：** 删除如下片段：

```tsx
{/* Tab description */}
<p className="text-xs shrink-0 -mt-1" style={{ color: "var(--color-text-subtle)" }}>
  {TABS.find(t => t.id === activeTab)?.desc}
</p>
```

并将 `TABS` 数组的 `desc` 字段信息合并进 PageHeader 的 subtitle，使其固定：

```tsx
<PageHeader
  title="过滤中心"
  subtitle="黑名单管理，内容清洗规则"
/>
```

（原 subtitle 是"黑名单管理 · 内容清洗规则"，有 `·` 分隔符，改用逗号。）

**验证：** 过滤中心页面 tab 切换不再有文字跳动，header subtitle 固定不变。

---

### Task 12: IdlePanel 视觉节奏改善

**问题：** IdlePanel 的扫描配置卡片内用了 `<div className="h-px">` 分割线，两个区块（日期 + 站点）间距感偏平，"开始扫描"按钮尺寸（未指定 size，默认 `md`）与图标行不成层级对比。

**文件：**
- 修改: `src/components/download/IdlePanel.tsx`

**改动 1：** 移除纯色分割线，改用更大的间距：
```tsx
{/* 删除这行 */}
<div className="h-px" style={{ background: "var(--color-border)" }} />
```

改为在两个 `<div>` 区块之间加 `gap-5` （原来卡片内是 `gap-4`，把 panel ref 的 flex gap 从 `gap-4` 改为 `gap-5`）。

**改动 2：** "开始扫描"按钮改为 `lg` 尺寸并给更多水平内边距：

```tsx
<Button
  onClick={onScan}
  size="lg"
  disabled={disabled || (scanOptions.enabled_sites?.length === 0)}
  className="px-12"
>
  <ScanSearch className="w-4 h-4" /> 开始扫描
</Button>
```

**验证：** IdlePanel 配置卡片两个区块靠间距分隔，无分割线；"开始扫描"按钮明显比 header action 按钮大，有视觉层级。

---

### Task 13: TaskListPanel 空状态升级

**问题：** 任务列表空时只有两行文字，无图标，与其他页面规范不符。

**文件：**
- 修改: `src/pages/tasks/TaskListPanel.tsx`

**改动：** 将：

```tsx
{tasks.length === 0 && (
  <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>暂无任务</p>
    <p className="text-[10px]" style={{ color: "var(--color-text-subtle)" }}>
      点击"新建"创建任务
    </p>
  </div>
)}
```

替换为：

```tsx
{tasks.length === 0 && (
  <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center"
      style={{
        background: "var(--color-accent-muted)",
        border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
      }}
    >
      <ListTodo className="w-6 h-6" style={{ color: "var(--color-accent)" }} />
    </div>
    <div className="text-center">
      <p className="text-xs font-medium" style={{ color: "var(--color-text)" }}>还没有任务</p>
      <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-subtle)" }}>
        点击「新建」开始
      </p>
    </div>
  </div>
)}
```

需要确认 `ListTodo` 已在文件顶部 import（来自 `lucide-react`，查看已有 import 列表）。

**验证：** 任务管理页左侧面板空时有小图标 + 两行文字，不再是裸文字。

---

### Task 14: WebsitesPage 空状态文案改善

**问题：** `"暂无站点配置，点击「添加站点」开始"` 语气偏机械，与产品"温暖书卷气"调性不符。

**文件：**
- 修改: `src/pages/WebsitesPage.tsx`

**改动：** 找到：

```tsx
<Card>
  <p className="text-center text-sm py-8" style={{ color: "var(--color-text-muted)" }}>
    暂无站点配置，点击「添加站点」开始
  </p>
</Card>
```

替换为完整 empty state：

```tsx
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
```

确认 `Globe`、`Plus` 已在顶部 import（均已有）。

**验证：** 网站配置页无站点时显示图标 + 标题 + 说明 + CTA 按钮的完整空状态。

---

### Task 15: LogPanel 空状态文案改善

**问题：** `"暂无日志"` 是系统术语，缺少动词和语境。

**文件：**
- 修改: `src/components/download/LogPanel.tsx`

**改动：** 找到：

```tsx
<p className="text-xs text-center py-8" style={{ color: "var(--color-text-muted)" }}>
  暂无日志
</p>
```

改为：

```tsx
<p className="text-xs text-center py-8" style={{ color: "var(--color-text-muted)" }}>
  运行后日志会显示在这里
</p>
```

**验证：** 日志面板无日志时显示"运行后日志会显示在这里"。

---

### Task 16: ScanPreview 空状态文案改善

**问题：** `"暂无数据"` 和 `"没有匹配的结果"` — 前者无动词，后者可以更具体。

**文件：**
- 修改: `src/components/download/ScanPreview.tsx`

**改动：** 在 flat view table 中找到：

```tsx
{search ? "没有匹配的结果" : "暂无数据"}
```

改为：

```tsx
{search ? `没有书名或站点匹配「${search}」` : "扫描完成后书单会出现在这里"}
```

**验证：** 无搜索词时显示"扫描完成后书单会出现在这里"；有搜索词时显示包含搜索词的提示。

---

## 批次 3：全局文案替换

### Task 17: TaskDetailPanel 文案改善

**问题：** 多处文案偏系统术语或过于简略。

**文件：**
- 修改: `src/pages/tasks/TaskDetailPanel.tsx`

**改动清单：**

1. `"等待日志..."` → `"任务开始后日志会显示在这里"` (TaskLogPanel 内)
2. `"正在扫描站点..."` → `"正在扫描，请稍候"` (DownloadingView/scanning状态)
3. `"任务已取消"` → `"已取消"` (cancelled 状态文字)
4. `"等待执行..."` → `"排队中，等待执行"` (queued 状态文字)
5. 空状态 `"选择任务查看详情"` 副标题 `"从左侧列表点击一个任务"` → 改为 `"从左侧选一个任务"` (更简洁)

逐一找到对应字符串，替换。

**验证：** 任务详情面板各状态文案符合口语风格。

---

### Task 18: QueueResumePanel 文案改善

**问题：** `"发现未完成的下载队列"` 偏技术术语。

**文件：**
- 修改: `src/components/download/QueueResumePanel.tsx`

**改动：** 找到：

```tsx
<p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
  发现未完成的下载队列
</p>
```

改为：

```tsx
<p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
  上次下载没有完成
</p>
```

**验证：** 队列恢复面板文案更自然。

---

### Task 19: SettingsPage / 配置加载中文案统一

**问题：** `"配置加载中..."` 出现在多个文件，偏技术术语，风格不一致。

**文件：**
- 修改: `src/pages/settings/SettingsPage.tsx`
- 修改: `src/pages/WebsitesPage.tsx`
- 修改: `src/pages/blacklist/BlacklistPage.tsx`
- 修改: `src/pages/rules/RulesPage.tsx`

**改动：** 各文件中所有：

```tsx
<div ... style={{ color: "var(--color-text-muted)" }}>配置加载中...</div>
```

改为：

```tsx
<div ... style={{ color: "var(--color-text-muted)" }}>正在加载...</div>
```

统一用"正在加载..."，不指定是"配置"加载，更通用。

**验证：** 以上页面在 config 未加载时统一显示"正在加载..."。

---

### Task 20: DownloadPage IdlePanel 文案改善

**问题：** `"准备好了"` + `"将扫描 N 个站点的最新章节"` 文案合理，但"准备好了"过于口语化，缺少仪式感。

**文件：**
- 修改: `src/components/download/IdlePanel.tsx`

**改动：** 找到：

```tsx
<p className="text-base font-semibold mb-1" style={{ color: "var(--color-text)" }}>
  准备好了
</p>
<p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
  将扫描{" "}
  <span className="font-semibold" style={{ color: "var(--color-text)" }}>
    {siteCount}
  </span>{" "}
  个站点的最新章节
</p>
```

改为：

```tsx
<p className="text-base font-semibold mb-1" style={{ color: "var(--color-text)" }}>
  开始新的一次扫描
</p>
<p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
  将检索{" "}
  <span className="font-semibold" style={{ color: "var(--color-text)" }}>
    {siteCount}
  </span>{" "}
  个站点的最新更新
</p>
```

**验证：** Idle 面板标题文案更有仪式感。

---

### Task 21: FilterPage ContentCleanTab 和 BlacklistTab 内部文案检查

**问题：** 需要检查过滤中心两个 tab 内的说明文案是否有系统术语或空状态问题。

**文件：**
- 修改: `src/pages/filter/ContentCleanTab.tsx` (如有问题)
- 修改: `src/pages/filter/BlacklistTab.tsx` (如有问题)
- 修改: `src/pages/blacklist/KeywordPanel.tsx` (如有问题)

**步骤：**

1. 打开 `ContentCleanTab.tsx`，搜索所有空状态文字（如"暂无"、"没有"开头的）和 toast 文案。
2. 打开 `BlacklistTab.tsx`，同上。
3. 打开 `KeywordPanel.tsx`，同上。

**改动规则：**
- `"暂无..."` → 改为有动词的描述，例如"还没有关键词，在上方输入后按回车添加"
- `"添加成功"` → `"已添加"`
- `"删除成功"` → `"已删除"`
- `"保存成功"` → `"已保存"`

**验证：** 过滤中心各面板无系统术语，空状态有引导文字。

---

## 批次 4：代码质量 + 可访问性

### Task 22: WebsitesPage useMemo 依赖修复

**问题：** `effectiveKeys` 的 useMemo 依赖了每次渲染都是新引用的 `syncedKeys` 和 `newKeys`，导致 memo 永远失效。

**文件：**
- 修改: `src/pages/WebsitesPage.tsx`

**改动：** 找到：

```tsx
const [orderedKeys, setOrderedKeys] = useState<string[]>(() =>
  config ? Object.keys(config.websites) : []
);

const websites = useMemo(() => config?.websites ?? {}, [config]);
const syncedKeys = orderedKeys.filter(k => k in websites);
const newKeys = Object.keys(websites).filter(k => !orderedKeys.includes(k));
const effectiveKeys = useMemo(() => [...syncedKeys, ...newKeys], [syncedKeys, newKeys]);
```

替换为：

```tsx
const [orderedKeys, setOrderedKeys] = useState<string[]>(() =>
  config ? Object.keys(config.websites) : []
);

const websites = useMemo(() => config?.websites ?? {}, [config]);
const effectiveKeys = useMemo(() => {
  const synced = orderedKeys.filter(k => k in websites);
  const added = Object.keys(websites).filter(k => !orderedKeys.includes(k));
  return [...synced, ...added];
}, [orderedKeys, websites]);
```

删除 `syncedKeys` 和 `newKeys` 这两个中间变量（它们没有被其他地方使用），合并进一个 `useMemo`，依赖稳定的 `orderedKeys` 和 `websites`。

**验证：** 网站配置页拖拽排序正常，添加/删除站点后列表正确更新。

---

### Task 23: Button hover 状态补充 CSS 降级

**问题：** `Button.tsx` 所有 hover 效果通过 JS `onMouseEnter`/`onMouseLeave` 操作 `el.style`，
阻止 CSS transition 正常工作（inline style 优先级高于 class），也无法响应 `:hover` CSS。
这是一个架构问题，完全重写影响面较大，此 task 做最小改善：让 `secondary` 变体 hover 用 Tailwind class 实现，
并确保 `transition-all` 能正常触发。

**文件：**
- 修改: `src/components/Button.tsx`

**当前问题核心：** `el.style.background = ...` 的 inline style 优先级高于任何 CSS class，
导致 `transition-all` 的缓动只对其他属性生效，background 变化瞬间跳变。

**改动：** 这个 task 专门针对 `secondary` 变体，用 CSS variable 方案实现无 JS hover：

在 `getVariantStyle` 的 `secondary` 分支，改用 `data-variant` + CSS 方案已超出此文件范围。
更简单的做法：**保留现有 JS hover，但把 `transition-all` 改为指定属性列表**，确保不触发意外的 layout 动画：

```tsx
className={`
  inline-flex items-center gap-1.5 rounded-[10px] font-medium
  transition-[color,background-color,border-color,box-shadow,transform,opacity]
  duration-100 ease-out
  cursor-pointer
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-[var(--color-accent)]
  disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none
  active:scale-[0.97]
  ${sizeClasses[size]} ${className}
`}
```

将 `transition-all` 改为 `transition-[color,background-color,border-color,box-shadow,transform,opacity]`，
明确指定过渡属性，排除布局属性（width/height/padding）。

**验证：** Button hover/active 过渡更流畅，无布局属性动画。

---

### Task 24: Sidebar NavLink 补充 focus-visible 样式

**问题：** Sidebar 的 NavLink 无 focus ring，键盘导航无反馈。

**文件：**
- 修改: `src/components/Sidebar.tsx`

**改动：** 给 NavLink 的 `className` 补充：

```tsx
className="relative flex items-center rounded-lg transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-1"
```

**验证：** Tab 到侧边栏导航项时有 accent 色 outline，不影响鼠标操作。

---

### Task 25: ScanPreview 复选框 focus-visible 补充

**问题：** ScanPreview 中的 `<input type="checkbox">` 只有 `accentColor`，无额外 focus 样式处理。

**文件：**
- 修改: `src/components/download/ScanPreview.tsx`

**改动：** 所有 `<input type="checkbox">` 加上 `className="rounded focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"`。

共有 3 处 checkbox（ScanRow、GroupedScanTable 的 group header checkbox、flat table 的全选 checkbox），逐一加上：

```tsx
<input
  type="checkbox"
  checked={...}
  onChange={...}
  className="rounded focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
  style={{ accentColor: "var(--color-accent)" }}
/>
```

**验证：** Tab 到复选框时有 accent 色 focus ring。

---

### Task 26: DownloadPage header 布局加 px-5 包裹

**问题：** `DownloadPage.tsx` 的 PageHeader 区域已有 `px-5 pt-5` 包裹，这个页面布局相对正确，但 `gap-0` 的父容器与其他页面使用 `gap-4` 不一致，导致状态栏和内容区间距依赖手动 `mt-4`，维护成本高。

**文件：**
- 修改: `src/pages/DownloadPage.tsx`

**改动：** 这个 task 主要清理一致性。将顶层容器从：

```tsx
<div className="flex flex-col h-full gap-0 overflow-hidden">
```

改为保持 `gap-0` 不变（因为内部每个区块都手动控制 margin），但在 PageHeader div 加 `shrink-0`（已有）。

真正需要修的是：Status bar 的 `mt-4` 和其他 `mt-4` 是手动间距，检查并确保数值一致（目前是 `mt-4 = 16px`，符合 DESIGN.md 的 `--space-4`）。这个 task 仅作审查，若发现 `mt-3`/`mt-5` 不一致则统一为 `mt-4`。

**验证：** 下载页各区块间距目视一致，无明显跳跃。

---

### Task 27: 全局检查 `select` 元素样式

**问题：** `WebsitesPage.tsx` 中有原生 `<select>` 元素，只有基础颜色，hover/focus 样式缺失。

**文件：**
- 修改: `src/pages/WebsitesPage.tsx`

**改动：** 找到 `<select>` 元素：

```tsx
<select
  className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
  ...
>
```

补充 focus-visible 样式和与 Input 组件一致的 focus ring：

```tsx
<select
  className="border rounded-[10px] px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] transition-colors cursor-pointer"
  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
  onFocus={(e) => {
    e.currentTarget.style.borderColor = "var(--color-accent)";
    e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
  }}
  onBlur={(e) => {
    e.currentTarget.style.borderColor = "var(--color-border)";
    e.currentTarget.style.boxShadow = "none";
  }}
  ...
>
```

border-radius 也从 `rounded-lg (8px)` 改为 `rounded-[10px]`，与 Input 组件一致。

**验证：** 网站配置页"下载模式"下拉框 focus 时有 accent 边框和 muted glow，与 Input 一致。

---

### Task 28: 补充 aria-label 到图标专用按钮

**问题：** 多处只有图标无文字的按钮（如 LogPanel 的清除按钮、各页面的刷新/删除按钮）缺少 `aria-label`，屏幕阅读器无法读出其功能。

**文件：**
- 修改: `src/components/download/LogPanel.tsx`
- 修改: `src/pages/HistoryPage.tsx` (内部刷新按钮)
- 修改: `src/components/download/QueueResumePanel.tsx`

**改动规则：** 所有只包含图标（无文字 children）的 `<button>` 或 `<Button>` 必须有 `title` 或 `aria-label`。

逐文件检查：

1. `LogPanel.tsx`：清除按钮已有 `<Trash2>` 但无文字，`<Button variant="ghost" size="sm" onClick={clearLogs}>` → 加 `aria-label="清空日志"`。

2. `QueueResumePanel.tsx`：清除按钮（`<Button variant="ghost" size="sm" onClick={clearQueueFile}>`）已有 `<XCircle>` 图标 + "清除"文字，OK。

3. `HistoryPage.tsx`：刷新按钮有文字"刷新"，OK。

主要需要检查的是纯图标按钮。若 `title` 已设置则等价于 `aria-label`，检查是否有 title。

**验证：** 使用浏览器 accessibility 工具检查，图标按钮有可读名称。

---

## 总结：变更文件清单

| 文件 | 涉及 Task |
|---|---|
| `src/components/Sidebar.tsx` | 1, 24 |
| `src/components/Button.tsx` | 5, 23 |
| `src/components/Input.tsx` | 6 |
| `src/components/download/IdlePanel.tsx` | 12, 20 |
| `src/components/download/LogPanel.tsx` | 15, 28 |
| `src/components/download/QueueResumePanel.tsx` | 18, 28 |
| `src/components/download/ScanPreview.tsx` | 16, 25 |
| `src/pages/DownloadPage.tsx` | 2, 26 |
| `src/pages/HealthPage.tsx` | 7 |
| `src/pages/ConverterPage.tsx` | 9 |
| `src/pages/WebsitesPage.tsx` | 14, 19, 22, 27 |
| `src/pages/history/HistoryPage.tsx` | 8, 10, 19 |
| `src/pages/history/historyColumns.tsx` | 3 |
| `src/pages/blacklist/BlacklistPage.tsx` | 4, 19 |
| `src/pages/filter/FilterPage.tsx` | 11 |
| `src/pages/filter/ContentCleanTab.tsx` | 21 |
| `src/pages/filter/BlacklistTab.tsx` | 21 |
| `src/pages/blacklist/KeywordPanel.tsx` | 21 |
| `src/pages/settings/SettingsPage.tsx` | 19 |
| `src/pages/rules/RulesPage.tsx` | 19 |
| `src/pages/tasks/TaskListPanel.tsx` | 13 |
| `src/pages/tasks/TaskDetailPanel.tsx` | 17 |

**总计：22 个文件，28 个 task。**

---

## 执行顺序建议

批次内 task 相互独立，可并行；批次间按序执行（后续批次依赖前批次的设计规范修复）。

建议执行顺序：
1. Task 1-6（批次1，设计规则，最优先）
2. Task 7-16（批次2，空状态和交互，用户最可见）
3. Task 17-21（批次3，文案，可与批次2 穿插）
4. Task 22-28（批次4，代码质量和可访问性）

# Product Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 提升 txtx 的产品完成度，优先补强主流程、历史查询性能、关键页面文案与开发文档。

**Architecture:** 保持现有 React + Zustand + React Query + Tauri 架构不变，采用增量增强方式推进。前端聚焦任务中心与高频页面完成度，桌面端历史能力优先复用已有 SQLite 查询逻辑，避免无意义重构。

**Tech Stack:** React 19, TypeScript, Zustand, TanStack Query, Tauri, Rust, SQLite

---

### Task 1: 基线审查与验证

**Files:**
- Inspect: `package.json`
- Inspect: `src/router.tsx`
- Inspect: `src/pages/**/*`

**Step 1: 运行测试基线**

Run: `pnpm test`
Expected: 现有测试通过，确认可以在健康基线上做增强

**Step 2: 运行 lint 与 build**

Run: `pnpm lint`
Run: `pnpm build`
Expected: 均通过，确认仓库当前可构建

### Task 2: 核心页面文案与可访问性修复

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/pages/DownloadPage.tsx`
- Modify: `src/pages/settings/SettingsPage.tsx`
- Modify: `src/router.tsx`

**Step 1: 修复乱码和高频文案**

将导航、空态、加载态、标题、按钮说明统一为自然中文。

**Step 2: 补足按钮辅助标签**

为展开/收起、命令面板等按钮补 `aria-label`。

### Task 3: 任务中心完成度增强

**Files:**
- Create: `src/pages/tasks/taskListUtils.ts`
- Create: `src/pages/tasks/taskListUtils.test.ts`
- Modify: `src/pages/tasks/TaskListPanel.tsx`
- Modify: `src/pages/tasks/list/TaskEmptyState.tsx`

**Step 1: 先写失败测试**

覆盖任务搜索、状态筛选、排序和摘要统计。

**Step 2: 实现任务列表工具逻辑**

提取纯函数，保证可测且便于复用。

**Step 3: 接入任务页 UI**

补充搜索框、筛选 chips、排序按钮、摘要信息和空结果态。

### Task 4: 历史查询性能优化

**Files:**
- Modify: `src/lib/api/history.ts`
- Modify: `src/pages/history/HistoryPage.tsx`
- Modify: `src/pages/history/useHistoryStats.ts`
- Modify: `src-tauri/src/history/mod.rs`
- Modify: `src-tauri/src/commands/misc_commands.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 桌面端切到分页查询命令**

避免前端全量拉取历史记录后再筛选与分页。

**Step 2: 下沉历史统计**

把图表统计下沉到后端查询，减少前端重复聚合。

**Step 3: 优化交互**

增加搜索延迟触发、下一页预取和合理缓存时间。

### Task 5: 文档补齐

**Files:**
- Create: `README.md`

**Step 1: 写清产品定位与功能**

描述主流程、核心页面与能力边界。

**Step 2: 写清开发方式**

补充启动、测试、lint、build、Tauri 调试命令。

### Task 6: 最终回归

**Files:**
- Verify only

**Step 1: 再跑测试**

Run: `pnpm test`

**Step 2: 再跑 lint**

Run: `pnpm lint`

**Step 3: 再跑 build**

Run: `pnpm build`

**Step 4: 桌面端编译校验**

Run: `cargo check --manifest-path src-tauri/Cargo.toml --features tauri-build`


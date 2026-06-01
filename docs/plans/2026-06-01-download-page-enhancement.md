# Download Page Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 引入 Anime.js 动画并大幅增强下载页面功能，包括 URL 历史 UI 完善、下载队列恢复、实时速度统计、批量操作增强、书单导出、快速操作面板等。

**Architecture:** 纯前端改动为主（Anime.js 动画、新 UI 组件），少量后端新增 REST 接口（队列查询/清除、书名预览、打开目录）。前端通过 api.ts 抽象层调用，Tauri 和 HTTP 模式均支持。

**Tech Stack:** React 19, TypeScript, Anime.js v4, Zustand, Tailwind CSS v4, Axum (Rust 后端)

---

## Task 1: 安装 Anime.js

**Files:**
- Modify: `txtx-app/package.json`

**Step 1: 安装依赖**

```bash
cd txtx-app && pnpm add animejs@^4
```

**Step 2: 验证安装**

检查 `node_modules/animejs` 存在，`package.json` 中有 `"animejs": "^4.x.x"`

---

## Task 2: 后端新增 3 个 REST 接口

**Files:**
- Modify: `txtx-app/src-tauri/src/server.rs`
- Modify: `txtx-app/src-tauri/src/lib.rs`

新增接口：
1. `GET /api/queue` — 读取 `download_queue.json`，返回队列信息
2. `DELETE /api/queue` — 清除 `download_queue.json`
3. `GET /api/novel-name?url=<url>` — 预览书名（调用 crawler::fetch_novel_name）
4. `POST /api/open-dir` — 打开输出目录（仅 Tauri 模式有效）

---

## Task 3: 前端 api.ts 新增对应调用

**Files:**
- Modify: `txtx-app/src/lib/api.ts`

新增：
- `apiGetQueue()` → `GET /api/queue`
- `apiClearQueue()` → `DELETE /api/queue`
- `apiPreviewNovelName(url)` → `GET /api/novel-name?url=`
- `apiOpenOutputDir()` → Tauri opener / noop in web

---

## Task 4: types/index.ts 新增类型

**Files:**
- Modify: `txtx-app/src/types/index.ts`

新增：
```typescript
export interface DownloadQueue {
  created_at: string;
  target_date: string;
  items: BookCandidate[];
}
```

---

## Task 5: Anime.js 动画工具模块

**Files:**
- Create: `txtx-app/src/lib/animations.ts`

封装常用动画：
- `animateCountUp(el, from, to)` — 数字滚动
- `animateProgressBar(el, pct)` — 进度条平滑
- `animateEnter(el)` — 卡片进入
- `animateCelebration(el)` — 完成庆祝 pulse
- `animateStagger(els)` — 列表错开进入

---

## Task 6: 增强 SingleDownloadInput — URL 历史 + 书名预览

**Files:**
- Modify: `txtx-app/src/pages/DownloadPage.tsx`（`SingleDownloadInput` 组件）

增强点：
- 粘贴/输入 URL 后 debounce 500ms 自动调用 `apiPreviewNovelName` 显示书名预览
- 历史下拉加入 Anime.js 展开动画
- 输入框 focus 时边框 glow 动画

---

## Task 7: 下载队列恢复面板

**Files:**
- Modify: `txtx-app/src/pages/DownloadPage.tsx`（新增 `QueueResumePanel` 组件）
- Modify: `txtx-app/src/store/downloadStore.ts`（新增 `queueInfo` 状态和 `loadQueue/clearQueue` action）

在 IdlePanel 中检测到未完成队列时，显示恢复提示卡片，支持一键恢复或清除。

---

## Task 8: 实时速度统计（章节/秒 + 预估剩余时间）

**Files:**
- Modify: `txtx-app/src/store/downloadStore.ts`（新增速度计算逻辑）
- Modify: `txtx-app/src/pages/DownloadPage.tsx`（`DownloadProgress` 组件新增速度显示）

在 downloadStore 中记录最近 10 秒的 chapter_done 事件时间戳，计算滑动窗口速度。

---

## Task 9: 进度数字滚动动画 + 完成庆祝动效

**Files:**
- Modify: `txtx-app/src/pages/DownloadPage.tsx`（`DownloadResultSummary` 组件）

- 成功/失败数字用 Anime.js countUp 动画
- 完成时整个结果卡片做 scale + fade-in 动画
- 全部成功时做绿色 pulse 庆祝效果

---

## Task 10: 站点卡片进入动画 + 进度条动画

**Files:**
- Modify: `txtx-app/src/pages/DownloadPage.tsx`（`ScanSiteCard`、`ProgressBar` 组件）

- `ScanSiteCard` 新增时做 slide-in-right 动画（Anime.js stagger）
- `ProgressBar` 宽度变化用 Anime.js 而非 CSS transition

---

## Task 11: 扫描预览表格批量操作增强

**Files:**
- Modify: `txtx-app/src/pages/DownloadPage.tsx`（`ScanPreview` 组件）

新增：
- 按站点分组全选/取消按钮（下拉菜单）
- 按排除原因批量强制加入（"全部黑名单项加入"、"全部已存在项加入"）
- 选中数量变化时数字做 countUp 动画

---

## Task 12: 书单导出功能

**Files:**
- Modify: `txtx-app/src/pages/DownloadPage.tsx`（`ScanPreview` 工具栏）

新增导出按钮，支持：
- 导出 CSV（书名、来源、日期、状态）
- 导出 JSON（完整 ScanItem 数组）
- 仅导出已选中项

---

## Task 13: 快速操作面板（完成后）

**Files:**
- Modify: `txtx-app/src/pages/DownloadPage.tsx`（`DownloadResultSummary` 组件）

新增：
- 一键重试所有失败项（重新触发 `startSelectedDownload` 仅传入失败项）
- 完成后一键打开输出目录（调用 `apiOpenOutputDir`）
- 按钮进入时做 Anime.js stagger 动画

---

## Task 14: StepIndicator 动画增强

**Files:**
- Modify: `txtx-app/src/pages/DownloadPage.tsx`（`StepIndicator` 组件）

- 步骤切换时做 Anime.js scale + color 过渡
- 完成步骤做 checkmark 弹入动画

---

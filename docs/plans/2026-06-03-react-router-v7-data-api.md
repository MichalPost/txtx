# React Router v7 Data API 迁移计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `MemoryRouter + Routes/Route` 迁移到 `createMemoryRouter + RouterProvider` 模式，获得类型安全路由、嵌套布局、路由级数据预加载 (loader)。

**Architecture:**  
定义一个中心路由配置文件 `src/router.tsx`，所有路由在此声明，包含一个根布局路由（包裹 Sidebar、CommandPalette、错误边界），子路由各自携带懒加载组件和可选 loader。`App.tsx` 只负责渲染 `<RouterProvider>`，数据提供者（QueryClient、Toaster）保留在 `main.tsx`。

**Tech Stack:** react-router-dom v7（已安装）、@tanstack/react-query v5（已安装，loader 中调用 queryClient.ensureQueryData 做预加载）

---

## 背景 & 现状

| 现状 | 目标 |
|------|------|
| `MemoryRouter` 直接包裹 `Routes` | `createMemoryRouter` + `RouterProvider` |
| `App.tsx` 混合布局 + 路由声明 | 路由配置 / 根布局 / 页面三层分离 |
| `configStore.loadConfig()` 在 `useEffect` 里触发 | 根布局 loader 预取，页面首渲染时数据已就绪 |
| `navigate` 参数无类型检查 | 通过路由配置类型导出 `TypedNavigate` 工具 |

---

## Task 1：创建类型安全路由声明文件

**Files:**
- Create: `src/router.tsx`

目标：将所有路由集中声明，懒加载组件保持，根路由携带 loader（预取 config），导出类型工具。

```tsx
// src/router.tsx
import { lazy, Suspense } from "react";
import { createMemoryRouter, Outlet, useNavigate, NavigateOptions } from "react-router-dom";
import type { To } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import { apiLoadConfig } from "@/lib/api";
import { RootLayout } from "@/layouts/RootLayout";

// ── 路由路径常量（类型安全导航的基础） ────────────────────────────
export const ROUTES = {
  home:      "/",
  tasks:     "/tasks",
  websites:  "/websites",
  rules:     "/rules",
  settings:  "/settings",
  filter:    "/filter",
  history:   "/history",
  health:    "/health",
  converter: "/converter",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

// ── 类型安全 navigate hook ────────────────────────────────────────
export function useAppNavigate() {
  const navigate = useNavigate();
  return (to: AppRoute, options?: NavigateOptions) => navigate(to as To, options);
}

// ── 页面懒加载 ────────────────────────────────────────────────────
const DownloadPage    = lazy(() => import("@/pages/DownloadPage").then(m => ({ default: m.DownloadPage })));
const WebsitesPage    = lazy(() => import("@/pages/WebsitesPage").then(m => ({ default: m.WebsitesPage })));
const RulesPage       = lazy(() => import("@/pages/rules/RulesPage").then(m => ({ default: m.RulesPage })));
const SettingsPage    = lazy(() => import("@/pages/settings/SettingsPage").then(m => ({ default: m.SettingsPage })));
const FilterPage      = lazy(() => import("@/pages/filter/FilterPage").then(m => ({ default: m.FilterPage })));
const HistoryPage     = lazy(() => import("@/pages/history/HistoryPage").then(m => ({ default: m.HistoryPage })));
const HealthPage      = lazy(() => import("@/pages/HealthPage").then(m => ({ default: m.HealthPage })));
const ConverterPage   = lazy(() => import("@/pages/ConverterPage").then(m => ({ default: m.ConverterPage })));
const TaskManagerPage = lazy(() => import("@/pages/tasks/TaskManagerPage").then(m => ({ default: m.TaskManagerPage })));

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full" style={{ color: "var(--color-text-muted)" }}>
      <span className="text-sm">加载中...</span>
    </div>
  );
}

// ── Router 实例 ───────────────────────────────────────────────────
export const router = createMemoryRouter([
  {
    path: "/",
    element: <RootLayout />,
    // 根布局 loader：预取 config，配合 react-query 缓存
    loader: async () => {
      await queryClient.ensureQueryData({
        queryKey: ["config"],
        queryFn: apiLoadConfig,
        staleTime: 60_000,
      });
      return null;
    },
    children: [
      { index: true, element: <Suspense fallback={<PageFallback />}><DownloadPage /></Suspense> },
      { path: "tasks",     element: <Suspense fallback={<PageFallback />}><TaskManagerPage /></Suspense> },
      { path: "websites",  element: <Suspense fallback={<PageFallback />}><WebsitesPage /></Suspense> },
      { path: "rules",     element: <Suspense fallback={<PageFallback />}><RulesPage /></Suspense> },
      { path: "settings",  element: <Suspense fallback={<PageFallback />}><SettingsPage /></Suspense> },
      { path: "filter",    element: <Suspense fallback={<PageFallback />}><FilterPage /></Suspense> },
      { path: "history",   element: <Suspense fallback={<PageFallback />}><HistoryPage /></Suspense> },
      { path: "health",    element: <Suspense fallback={<PageFallback />}><HealthPage /></Suspense> },
      { path: "converter", element: <Suspense fallback={<PageFallback />}><ConverterPage /></Suspense> },
    ],
  },
]);
```

---

## Task 2：将 QueryClient 提取为单例模块

**Files:**
- Create: `src/lib/queryClient.ts`
- Modify: `src/main.tsx`

router.tsx 中的 loader 需要在 React 树之外访问 `queryClient`，所以把它从 `main.tsx` 提取为独立模块。

```ts
// src/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});
```

修改 `src/main.tsx`，从该模块导入：

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/queryClient";
import { router } from "@/router";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  </React.StrictMode>
);
```

---

## Task 3：创建根布局组件

**Files:**
- Create: `src/layouts/RootLayout.tsx`

把原来 `App.tsx` 中的布局（Sidebar + main + 错误提示 + CommandPalette）迁移到根布局，用 `<Outlet />` 渲染子路由。

configStore 改为从 react-query 缓存读取（loader 已预取），不再依赖 `useEffect`。

```tsx
// src/layouts/RootLayout.tsx
import { Outlet, useNavigation } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { useQuery } from "@tanstack/react-query";
import { apiLoadConfig } from "@/lib/api";

export function RootLayout() {
  // loader 已预取，这里只是订阅缓存，不触发新请求
  const { error } = useQuery({
    queryKey: ["config"],
    queryFn: apiLoadConfig,
    staleTime: 60_000,
  });

  // RouterProvider 提供的导航过渡状态（可选：加全局加载指示）
  const navigation = useNavigation();
  const isNavigating = navigation.state === "loading";

  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      style={{ background: "var(--color-bg)" }}
    >
      <Sidebar />
      <main className="flex-1 overflow-hidden relative">
        {error && (
          <div
            className="m-4 px-4 py-3 rounded-lg border text-sm"
            style={{
              background: "var(--color-danger-bg)",
              borderColor: "var(--color-danger)",
              color: "var(--color-danger)",
            }}
          >
            配置加载失败：{String(error)}
          </div>
        )}
        {/* 路由跳转时的顶部进度条（可选） */}
        {isNavigating && (
          <div
            className="absolute top-0 left-0 right-0 h-0.5 animate-pulse"
            style={{ background: "var(--color-accent)" }}
          />
        )}
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  );
}
```

---

## Task 4：更新 configStore — 从 react-query 缓存读取

**Files:**
- Modify: `src/store/configStore.ts`
- Modify: `src/pages/DownloadPage.tsx`（以及其他用到 `useConfigStore` 的组件）

loader 预取之后，`configStore` 的 `loadConfig` 职责转移。两种选项：

**方案 A（最小改动）**：保留 `configStore`，但 `loadConfig` 内部从 queryClient 缓存读取，避免重复请求：

```ts
// src/store/configStore.ts — 修改 loadConfig
import { queryClient } from "@/lib/queryClient";

loadConfig: async () => {
  set({ loading: true, error: null });
  try {
    // 优先从 react-query 缓存获取，loader 已预取则零延迟
    const config = await queryClient.ensureQueryData({
      queryKey: ["config"],
      queryFn: apiLoadConfig,
      staleTime: 60_000,
    });
    set({ config, loading: false });
  } catch (e) {
    set({ error: String(e), loading: false });
  }
},
```

这样无需修改各页面中 `useConfigStore` 的调用，迁移成本最低。

**方案 B（推荐，但改动较多）**：完全移除 `configStore`，所有组件直接用 `useQuery({ queryKey: ["config"] })`。此方案可在后续单独进行，不列入本次迁移范围。

> 本次采用方案 A。

---

## Task 5：更新 App.tsx

**Files:**
- Modify: `src/App.tsx`

原 `App.tsx` 的内容全部迁移后，简化为空导出或删除，由 `main.tsx` 直接使用 `router`：

```tsx
// src/App.tsx — 可完全删除，或保留空文件防止 import 报错
// 已由 src/router.tsx + src/layouts/RootLayout.tsx 替代
export {};
```

实际上 `main.tsx` 改为直接渲染 `<RouterProvider router={router} />`，无需再 import App，可直接删除 `App.tsx`。

---

## Task 6：更新 CommandPalette 和 Sidebar 的导航调用（可选）

**Files:**
- Modify: `src/components/CommandPalette.tsx`
- Modify: `src/components/Sidebar.tsx`

将 `useNavigate()` 替换为 `useAppNavigate()`，获得路由路径的类型检查：

```ts
// CommandPalette.tsx
import { useAppNavigate } from "@/router";
// ...
const navigate = useAppNavigate();
// navigate("/websites")  ← 输入错误路径会有 TS 报错
```

`Sidebar.tsx` 中的 `navItems[].to` 改为 `AppRoute` 类型：

```ts
import type { AppRoute } from "@/router";
const navItems: Array<{ to: AppRoute; icon: ...; label: string }> = [...]
```

---

## 执行顺序

```
Task 2 → Task 3 → Task 1 → Task 5 → Task 4 → Task 6
```

（先建依赖，再建引用者）

---

## 验证方式

```bash
pnpm build   # tsc + vite build，零类型错误
pnpm dev     # 启动后所有页面可正常跳转，config 不再出现加载闪烁
```

导航类型检查验证：在 `CommandPalette.tsx` 中故意写 `navigate("/nonexistent")`，应得到 TypeScript 报错。

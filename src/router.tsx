import { lazy, Suspense } from "react";
import {
  createHashRouter,
  useNavigate,
  type NavigateOptions,
  type To,
} from "react-router-dom";
import { RootLayout } from "@/layouts/RootLayout";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ErrorPage } from "@/pages/ErrorPage";

// ── 路由路径常量 ──────────────────────────────────────────────────
export const ROUTES = {
  home:       "/",
  tasks:      "/tasks",
  websites:   "/websites",
  rules:      "/rules",
  settings:   "/settings",
  filter:     "/filter",
  history:    "/history",
  health:     "/health",
  converter:  "/converter",
  bookshelf:  "/bookshelf",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * 类型安全的 navigate hook。
 * 只允许跳转到已声明的应用路由，错误路径在编译时报错。
 */
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
const BookshelfPage   = lazy(() => import("@/pages/bookshelf/BookshelfPage").then(m => ({ default: m.BookshelfPage })));
const TaskManagerPage = lazy(() => import("@/pages/tasks/TaskManagerPage").then(m => ({ default: m.TaskManagerPage })));

function PageFallback() {
  return (
    <div
      className="flex items-center justify-center h-full"
      style={{ color: "var(--color-text-muted)" }}
    >
      <span className="text-sm">加载中...</span>
    </div>
  );
}

// HydrateFallback：router 初始化时显示，避免警告且防止空白闪烁
function AppFallback() {
  return (
    <div
      className="flex h-screen w-screen items-center justify-center"
      style={{ background: "var(--color-bg)", color: "var(--color-text-muted)" }}
    >
      <span className="text-sm">启动中...</span>
    </div>
  );
}

function wrap(Page: React.ComponentType) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Page />
    </Suspense>
  );
}

// ── Router 实例 ───────────────────────────────────────────────────
// 使用 createHashRouter 替代 createMemoryRouter：
// - 路由状态保存在 URL hash (#/rules 等)，HMR 不会重置路由
// - Tauri 的 file:// 协议完全兼容 hash 路由
// - 开发时刷新页面也能恢复当前页

const routeConfig = [
  {
    path: "/",
    element: <RootLayout />,
    HydrateFallback: AppFallback,
    errorElement: <ErrorPage />,
    children: [
      { index: true,          element: wrap(DownloadPage) },
      { path: "tasks",        element: wrap(TaskManagerPage) },
      { path: "websites",     element: wrap(WebsitesPage) },
      { path: "rules",        element: wrap(RulesPage) },
      { path: "settings",     element: wrap(SettingsPage) },
      { path: "filter",       element: wrap(FilterPage) },
      { path: "history",      element: wrap(HistoryPage) },
      { path: "health",       element: wrap(HealthPage) },
      { path: "converter",    element: wrap(ConverterPage) },
      { path: "bookshelf",   element: wrap(BookshelfPage) },
      { path: "*",            element: <NotFoundPage /> },
    ],
  },
];

export const router = createHashRouter(routeConfig);

// dev 环境下，打印所有路由跳转，方便排查非预期导航
if (import.meta.env.DEV) {
  router.subscribe((state) => {
    console.log("[router]", state.location.pathname, state.navigation.state);
  });
}

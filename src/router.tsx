import { lazy, Suspense } from "react";
import {
  createHashRouter,
  Navigate,
  useNavigate,
  type NavigateOptions,
  type To,
} from "react-router-dom";

import { RootLayout } from "@/layouts/RootLayout";
import { ErrorPage } from "@/pages/ErrorPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const ROUTES = {
  home: "/",
  tasks: "/tasks",
  rules: "/rules",
  settings: "/settings",
  filter: "/filter",
  history: "/history",
  health: "/health",
  converter: "/converter",
  bookshelf: "/bookshelf",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Type-safe navigate hook.
 * Only allows jumping to routes declared inside the app.
 */
export function useAppNavigate() {
  const navigate = useNavigate();
  return (to: AppRoute, options?: NavigateOptions) => navigate(to as To, options);
}

const DownloadPage = lazy(() =>
  import("@/pages/DownloadPage").then((m) => ({ default: m.DownloadPage })),
);
const RulesPage = lazy(() =>
  import("@/pages/rules/RulesPage").then((m) => ({ default: m.RulesPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const FilterPage = lazy(() =>
  import("@/pages/filter/FilterPage").then((m) => ({ default: m.FilterPage })),
);
const HistoryPage = lazy(() =>
  import("@/pages/history/HistoryPage").then((m) => ({ default: m.HistoryPage })),
);
const HealthPage = lazy(() =>
  import("@/pages/HealthPage").then((m) => ({ default: m.HealthPage })),
);
const ConverterPage = lazy(() =>
  import("@/pages/ConverterPage").then((m) => ({ default: m.ConverterPage })),
);
const BookshelfPage = lazy(() =>
  import("@/pages/bookshelf/BookshelfPage").then((m) => ({ default: m.BookshelfPage })),
);
const TaskManagerPage = lazy(() =>
  import("@/pages/tasks/TaskManagerPage").then((m) => ({ default: m.TaskManagerPage })),
);

function PageFallback() {
  return (
    <div
      className="flex h-full items-center justify-center"
      style={{ color: "var(--color-text-muted)" }}
    >
      <span className="text-sm">页面加载中...</span>
    </div>
  );
}

function AppFallback() {
  return (
    <div
      className="flex h-screen w-screen items-center justify-center"
      style={{ background: "var(--color-bg)", color: "var(--color-text-muted)" }}
    >
      <span className="text-sm">应用初始化中...</span>
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

const routeConfig = [
  {
    path: "/",
    element: <RootLayout />,
    HydrateFallback: AppFallback,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: wrap(DownloadPage) },
      { path: "tasks", element: wrap(TaskManagerPage) },
      { path: "websites", element: <Navigate to="/rules" replace /> },
      { path: "rules", element: wrap(RulesPage) },
      { path: "settings", element: wrap(SettingsPage) },
      { path: "filter", element: wrap(FilterPage) },
      { path: "history", element: wrap(HistoryPage) },
      { path: "health", element: wrap(HealthPage) },
      { path: "converter", element: wrap(ConverterPage) },
      { path: "bookshelf", element: wrap(BookshelfPage) },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createHashRouter(routeConfig);

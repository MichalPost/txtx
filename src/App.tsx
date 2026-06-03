import { lazy, Suspense, useEffect } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { useConfigStore } from "@/store/configStore";

// 路由级懒加载 — 每个页面独立 chunk，首屏只加载 DownloadPage
const DownloadPage    = lazy(() => import("@/pages/DownloadPage").then(m => ({ default: m.DownloadPage })));
const WebsitesPage    = lazy(() => import("@/pages/WebsitesPage").then(m => ({ default: m.WebsitesPage })));
const SettingsPage    = lazy(() => import("@/pages/settings/SettingsPage").then(m => ({ default: m.SettingsPage })));
const BlacklistPage   = lazy(() => import("@/pages/blacklist/BlacklistPage").then(m => ({ default: m.BlacklistPage })));
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

export default function App() {
  const { loadConfig, error } = useConfigStore();

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return (
    <MemoryRouter>
      <div
        className="flex h-screen w-screen overflow-hidden"
        style={{ background: "var(--color-bg)" }}
      >
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          {error && (
            <div
              className="m-4 px-4 py-3 rounded-lg border text-sm"
              style={{
                background: "var(--color-danger-bg)",
                borderColor: "var(--color-danger)",
                color: "var(--color-danger)",
              }}
            >
              配置加载失败：{error}
            </div>
          )}
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<DownloadPage />} />
              <Route path="/tasks" element={<TaskManagerPage />} />
              <Route path="/websites" element={<WebsitesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/blacklist" element={<BlacklistPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/health" element={<HealthPage />} />
              <Route path="/converter" element={<ConverterPage />} />
            </Routes>
          </Suspense>
        </main>
        <CommandPalette />
      </div>
    </MemoryRouter>
  );
}

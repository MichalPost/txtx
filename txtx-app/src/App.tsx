import { useEffect } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { DownloadPage } from "@/pages/DownloadPage";
import { WebsitesPage } from "@/pages/WebsitesPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { BlacklistPage } from "@/pages/blacklist/BlacklistPage";
import { HistoryPage } from "@/pages/history/HistoryPage";
import { HealthPage } from "@/pages/HealthPage";
import { ConverterPage } from "@/pages/ConverterPage";
import { useConfigStore } from "@/store/configStore";

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
          <Routes>
            <Route path="/" element={<DownloadPage />} />
            <Route path="/websites" element={<WebsitesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/blacklist" element={<BlacklistPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/converter" element={<ConverterPage />} />
          </Routes>
        </main>
        <CommandPalette />
      </div>
    </MemoryRouter>
  );
}

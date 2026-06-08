import { toast } from "sonner";
import { create } from "zustand";

import { apiLoadConfig, apiSaveConfig } from "@/lib/api";
import type { AppConfig } from "@/types";

/** 后端刚启动时可能还没就绪，最多重试 10 次，每次间隔 800ms */
async function loadConfigWithRetry(maxRetries = 10, delayMs = 800): Promise<AppConfig> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiLoadConfig();
    } catch (e) {
      const isNetworkError = e instanceof TypeError && /fetch|network/i.test(String(e));
      if (!isNetworkError || i === maxRetries - 1) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  // unreachable, but satisfies TS
  return apiLoadConfig();
}

interface ConfigState {
  config: AppConfig | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  loadConfig: () => Promise<void>;
  /** silent=true 时不弹 toast，用于自动保存（拖拽、删除、切换等） */
  saveConfig: (config: AppConfig, silent?: boolean) => Promise<void>;
  updateConfig: (updater: (c: AppConfig) => AppConfig) => void;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  loading: false,
  saving: false,
  error: null,

  loadConfig: async () => {
    // 已加载过或正在加载则跳过，避免并发重复请求
    if (get().config !== null || get().loading) return;
    set({ loading: true, error: null });
    try {
      const config = await loadConfigWithRetry();
      set({ config, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  saveConfig: async (config: AppConfig, silent = false) => {
    set({ saving: true, error: null });
    try {
      await apiSaveConfig(config);
      set({ config, saving: false });
      if (!silent) toast.success("配置已保存");
    } catch (e) {
      set({ error: String(e), saving: false });
      toast.error(`保存失败: ${String(e)}`);
      throw e;
    }
  },

  updateConfig: (updater) => {
    const { config } = get();
    if (config) set({ config: updater(config) });
  },
}));

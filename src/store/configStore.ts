import { create } from "zustand";
import { toast } from "sonner";
import { apiLoadConfig, apiSaveConfig } from "@/lib/api";
import type { AppConfig } from "@/types";

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
    // 已加载过则跳过，避免重复请求
    if (get().config !== null) return;
    set({ loading: true, error: null });
    try {
      const config = await apiLoadConfig();
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
    }
  },

  updateConfig: (updater) => {
    const { config } = get();
    if (config) set({ config: updater(config) });
  },
}));

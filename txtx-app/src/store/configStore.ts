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
  saveConfig: (config: AppConfig) => Promise<void>;
  updateConfig: (updater: (c: AppConfig) => AppConfig) => void;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  loading: false,
  saving: false,
  error: null,

  loadConfig: async () => {
    set({ loading: true, error: null });
    try {
      const config = await apiLoadConfig();
      set({ config, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  saveConfig: async (config: AppConfig) => {
    set({ saving: true, error: null });
    try {
      await apiSaveConfig(config);
      set({ config, saving: false });
      toast.success("配置已保存");
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

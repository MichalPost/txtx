/**
 * AI 助手配置 store
 * 支持多供应商配置，配置（含 API Key）持久化到后端 SQLite。
 *
 * 数据结构参考 medrecai config.json 的 providers 设计：
 * - providers: 已配置的供应商列表，每个有独立的 key/url/model 等
 * - active_provider: 当前活跃供应商名称
 * - enabled: 是否启用 AI 功能
 *
 * ai.ts 通过 useAiStore.getState().activeConfig() 获取当前活跃的 AiConfig。
 */
import { toast } from "sonner";
import { create } from "zustand";

import { API_BASE, IS_TAURI } from "@/lib/api/constants";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** 单个供应商配置（对应 medrecai ProviderEntry） */
export interface AiProviderEntry {
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  available_models: string[];
  max_tokens: number;
  temperature: number;
}

/** 整体 AI 配置（存 SQLite） */
export interface AiMultiConfig {
  enabled: boolean;
  active_provider: string;
  providers: AiProviderEntry[];
}

/** 当前活跃供应商的运行时视图，供 ai.ts 直接使用。 */
export interface AiConfig {
  enabled: boolean;
  provider: string;
  base_url: string;
  api_key: string;
  model: string;
  max_tokens: number;
  temperature: number;
}

// ─── Provider presets ──────────────────────────────────────────────────────────

export type AiProviderPresetKey = "openai" | "deepseek" | "ollama" | "longcat" | "iflow" | "custom";

export const AI_PROVIDER_PRESETS: Record<
  AiProviderPresetKey,
  Pick<AiProviderEntry, "base_url" | "model" | "available_models">
> = {
  openai: {
    base_url: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    available_models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o4-mini"],
  },
  deepseek: {
    base_url: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    available_models: ["deepseek-chat", "deepseek-reasoner"],
  },
  ollama: {
    base_url: "http://localhost:11434/v1",
    model: "qwen2.5:7b",
    available_models: ["qwen2.5:7b", "qwen2.5:14b", "llama3.2:3b"],
  },
  longcat: {
    base_url: "https://api.longcat.chat/openai",
    model: "LongCat-Flash-Lite",
    available_models: ["LongCat-Flash-Lite", "LongCat-Flash", "LongCat-Plus"],
  },
  iflow: {
    base_url: "https://apis.iflow.cn/v1",
    model: "glm-4.6",
    available_models: ["glm-4.6", "glm-4-plus", "glm-4-flash"],
  },
  custom: {
    base_url: "",
    model: "",
    available_models: [],
  },
};

export const AI_PROVIDER_PRESET_LABELS: Record<AiProviderPresetKey, string> = {
  openai: "OpenAI",
  deepseek: "DeepSeek（推荐，性价比高）",
  ollama: "Ollama（本地模型）",
  longcat: "LongCat（高并发场景）",
  iflow: "iFlow（GLM 系列）",
  custom: "自定义",
};

// ─── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_MULTI_CONFIG: AiMultiConfig = {
  enabled: false,
  active_provider: "deepseek",
  providers: [
    {
      name: "deepseek",
      ...AI_PROVIDER_PRESETS.deepseek,
      api_key: "",
      max_tokens: 2048,
      temperature: 0.2,
    },
  ],
};

// ─── Backend API ───────────────────────────────────────────────────────────────

async function apiLoadAiConfig(): Promise<AiMultiConfig> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<AiMultiConfig>("load_ai_config");
  }
  const res = await fetch(`${API_BASE}/api/ai/config`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<AiMultiConfig>;
}

async function apiSaveAiConfig(config: AiMultiConfig): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("save_ai_config", { config });
  }
  const res = await fetch(`${API_BASE}/api/ai/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ─── Store ─────────────────────────────────────────────────────────────────────

interface AiStore {
  config: AiMultiConfig;
  loaded: boolean;

  load: () => Promise<void>;
  save: () => Promise<void>;
  flushSave: () => Promise<void>;

  /** 快捷读：当前活跃的供应商 entry */
  activeProvider: () => AiProviderEntry | undefined;
  /** 返回当前活跃供应商的 AiConfig 视图（供 ai.ts 使用） */
  activeConfig: () => AiConfig;

  /** 全局开关 */
  setEnabled: (v: boolean) => void;
  /** 切换活跃供应商 */
  setActiveProvider: (name: string) => void;

  /** 供应商 CRUD */
  addProvider: (entry: AiProviderEntry) => void;
  updateProvider: (name: string, patch: Partial<AiProviderEntry>) => void;
  removeProvider: (name: string) => void;

  /** 测试某供应商连通性 */
  testProvider: (name: string) => Promise<{ ok: boolean; message: string }>;
}

export const useAiStore = create<AiStore>((set, get) => {
  // saveTimer lives inside the closure so it is scoped per store instance.
  // This prevents stale timer references across HMR reloads in development.
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    config: DEFAULT_MULTI_CONFIG,
    loaded: false,

    load: async () => {
      try {
        const saved = await apiLoadAiConfig();
        set({ config: { ...DEFAULT_MULTI_CONFIG, ...saved }, loaded: true });
      } catch {
        set({ config: DEFAULT_MULTI_CONFIG, loaded: true });
      }
    },

    save: async () => {
      try {
        await apiSaveAiConfig(get().config);
      } catch (e) {
        toast.error(`AI 配置保存失败: ${String(e)}`);
        throw e;
      }
    },

    flushSave: async () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      await get().save();
    },

    activeProvider: () => {
      const { config } = get();
      return config.providers.find((p) => p.name === config.active_provider) ?? config.providers[0];
    },

    activeConfig: () => {
      const entry = get().activeProvider();
      const { config } = get();
      if (!entry) {
        return {
          enabled: config.enabled,
          provider: "",
          base_url: "",
          api_key: "",
          model: "",
          max_tokens: 2048,
          temperature: 0.2,
        };
      }
      return {
        enabled: config.enabled,
        provider: entry.name,
        base_url: entry.base_url,
        api_key: entry.api_key,
        model: entry.model,
        max_tokens: entry.max_tokens,
        temperature: entry.temperature,
      };
    },

    setEnabled: (v) => {
      set((s) => ({ config: { ...s.config, enabled: v } }));
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => get().save(), 600);
    },

    setActiveProvider: (name) => {
      set((s) => ({ config: { ...s.config, active_provider: name } }));
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => get().save(), 600);
    },

    addProvider: (entry) => {
      set((s) => ({
        config: { ...s.config, providers: [...s.config.providers, entry] },
      }));
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => get().save(), 600);
    },

    updateProvider: (name, patch) => {
      set((s) => {
        const newName = patch.name ?? name;
        const providers = s.config.providers.map((p) => (p.name === name ? { ...p, ...patch } : p));
        // 如果改了名字，同步更新 active_provider
        const active_provider =
          s.config.active_provider === name ? newName : s.config.active_provider;
        return { config: { ...s.config, providers, active_provider } };
      });
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => get().save(), 600);
    },

    removeProvider: (name) => {
      set((s) => {
        const remaining = s.config.providers.filter((p) => p.name !== name);
        const active =
          s.config.active_provider === name ? (remaining[0]?.name ?? "") : s.config.active_provider;
        return { config: { ...s.config, providers: remaining, active_provider: active } };
      });
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => get().save(), 600);
    },

    testProvider: async (name) => {
      const entry = get().config.providers.find((p) => p.name === name);
      if (!entry) return { ok: false, message: "找不到该供应商" };
      if (!entry.base_url || !entry.model) {
        return { ok: false, message: "请先填写 Base URL 和模型名称" };
      }
      try {
        const { aiComplete } = await import("@/lib/ai");
        const fakeConfig: AiConfig = {
          enabled: true,
          provider: entry.name,
          base_url: entry.base_url,
          api_key: entry.api_key,
          model: entry.model,
          max_tokens: entry.max_tokens,
          temperature: entry.temperature,
        };
        const reply = await aiComplete("请回复：pong", "你是测试助手，只回复 pong。", fakeConfig);
        if (reply.toLowerCase().includes("pong")) {
          return { ok: true, message: `连接正常，模型：${entry.model}` };
        }
        return { ok: true, message: `已连接，模型回复：${reply.slice(0, 40)}` };
      } catch (e) {
        return { ok: false, message: String(e) };
      }
    },
  };
});

/**
 * AI 助手配置 store
 * 配置（含 API Key）持久化到后端 SQLite，通过 Tauri invoke 或 HTTP API 读写。
 */
import { create } from "zustand";
import { IS_TAURI, API_BASE } from "@/lib/api/constants";

// 参考 medrecai config.json 的 providers 结构扩展 provider 预设
export type AiProvider = "openai" | "deepseek" | "ollama" | "longcat" | "iflow" | "custom";

export interface AiConfig {
  enabled: boolean;
  provider: AiProvider;
  base_url: string;
  api_key: string;
  model: string;
  max_tokens: number;
  temperature: number;
}

export const AI_PROVIDER_PRESETS: Record<
  AiProvider,
  Omit<AiConfig, "enabled" | "api_key" | "temperature" | "max_tokens">
> = {
  openai:   { provider: "openai",   base_url: "https://api.openai.com/v1",         model: "gpt-4o-mini" },
  deepseek: { provider: "deepseek", base_url: "https://api.deepseek.com/v1",        model: "deepseek-chat" },
  ollama:   { provider: "ollama",   base_url: "http://localhost:11434/v1",           model: "qwen2.5:7b" },
  longcat:  { provider: "longcat",  base_url: "https://api.longcat.chat/openai",    model: "LongCat-Flash-Lite" },
  iflow:    { provider: "iflow",    base_url: "https://apis.iflow.cn/v1",           model: "glm-4.6" },
  custom:   { provider: "custom",   base_url: "",                                    model: "" },
};

const DEFAULT_CONFIG: AiConfig = {
  enabled: false,
  ...AI_PROVIDER_PRESETS.deepseek,
  api_key: "",
  max_tokens: 2048,
  temperature: 0.2,
};

// ─── Backend API ───────────────────────────────────────────────────────────────

async function apiLoadAiConfig(): Promise<AiConfig> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<AiConfig>("load_ai_config");
  }
  const res = await fetch(`${API_BASE}/api/ai/config`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<AiConfig>;
}

async function apiSaveAiConfig(config: AiConfig): Promise<void> {
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
  config: AiConfig;
  testStatus: "idle" | "testing" | "ok" | "error";
  testMessage: string;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AiConfig>) => void;
  save: () => Promise<void>;
  testConnection: () => Promise<void>;
}

export const useAiStore = create<AiStore>((set, get) => ({
  config: DEFAULT_CONFIG,
  testStatus: "idle",
  testMessage: "",
  loaded: false,

  load: async () => {
    try {
      const saved = await apiLoadAiConfig();
      set({ config: { ...DEFAULT_CONFIG, ...saved }, loaded: true });
    } catch {
      // DB not ready yet (first launch, no base_dir), use defaults
      set({ config: DEFAULT_CONFIG, loaded: true });
    }
  },

  update: (patch) => {
    set((s) => ({ config: { ...s.config, ...patch } }));
  },

  save: async () => {
    await apiSaveAiConfig(get().config);
  },

  testConnection: async () => {
    const { config } = get();
    if (!config.base_url || !config.model) {
      set({ testStatus: "error", testMessage: "请先填写 Base URL 和模型名称" });
      return;
    }
    set({ testStatus: "testing", testMessage: "" });
    try {
      const { aiComplete } = await import("@/lib/ai");
      const reply = await aiComplete("请回复：pong", "你是测试助手，只回复 pong。", config);
      if (reply.toLowerCase().includes("pong")) {
        set({ testStatus: "ok", testMessage: `连接正常，模型：${config.model}` });
      } else {
        set({ testStatus: "ok", testMessage: `已连接，模型回复：${reply.slice(0, 40)}` });
      }
    } catch (e) {
      set({ testStatus: "error", testMessage: String(e) });
    }
  },
}));

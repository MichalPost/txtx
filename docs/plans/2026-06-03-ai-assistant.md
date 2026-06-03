# AI 智能助手功能实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 txtx 中引入 LLM AI 能力，覆盖三个核心场景：AI 配置管理（Task 1）、源码查看器 AI 增强（Task 2）、网站编辑器批量 XPath 分析（Task 3）。

**Architecture:** 全部纯前端实现。AI 调用直接从浏览器 fetch LLM API（OpenAI 兼容接口），无需修改 Rust 后端。API Key 通过 IndexedDB（现有 `persistSet`/`persistGet` 工具）持久化存储。AI store 用 Zustand 管理状态，`lib/ai.ts` 封装所有 LLM 调用逻辑，XPath 验证用浏览器原生 `DOMParser` + `document.evaluate`。

**Tech Stack:** React 19, TypeScript, Zustand, lucide-react（Sparkles 图标已在包内），`idb-keyval`（现有依赖），现有设计系统和组件库，无新依赖。

**关键约束：**
- API Key 存入 IndexedDB（`persistSet`），不进 AppConfig 也不写入磁盘配置文件
- 支持 OpenAI、DeepSeek、Ollama 三个 provider 预设 + custom
- 所有 AI 功能均为可选增强，AI 不可用时保留手动路径
- HTML 送给 AI 前预处理：去除 script/style 内容，截取前 200 行

---

## Task 1：AI 配置管理基础设施

**Files:**
- 创建：`src/store/aiStore.ts`
- 创建：`src/lib/ai.ts`
- 创建：`src/pages/settings/sections/AiSection.tsx`
- 修改：`src/pages/settings/SettingsPage.tsx`（引入 AiSection）

---

### Step 1：创建 `src/store/aiStore.ts`

```typescript
/**
 * AI 助手配置 store
 * API Key 通过 IndexedDB 持久化（不进配置文件）
 */
import { create } from "zustand";
import { persistGet, persistSet } from "@/lib/persist";

export type AiProvider = "openai" | "deepseek" | "ollama" | "custom";

export interface AiConfig {
  enabled: boolean;
  provider: AiProvider;
  base_url: string;
  api_key: string;
  model: string;
  max_tokens: number;
  temperature: number;
}

export const AI_PROVIDER_PRESETS: Record<AiProvider, Omit<AiConfig, "enabled" | "api_key" | "temperature" | "max_tokens">> = {
  openai:   { provider: "openai",   base_url: "https://api.openai.com/v1",   model: "gpt-4o-mini" },
  deepseek: { provider: "deepseek", base_url: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  ollama:   { provider: "ollama",   base_url: "http://localhost:11434/v1",    model: "qwen2.5:7b" },
  custom:   { provider: "custom",   base_url: "",                             model: "" },
};

const DEFAULT_CONFIG: AiConfig = {
  enabled: false,
  provider: "deepseek",
  ...AI_PROVIDER_PRESETS.deepseek,
  api_key: "",
  max_tokens: 2048,
  temperature: 0.2,
};

const PERSIST_KEY = "ai-config";

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
    const saved = await persistGet<AiConfig>(PERSIST_KEY, DEFAULT_CONFIG);
    set({ config: { ...DEFAULT_CONFIG, ...saved }, loaded: true });
  },

  update: (patch) => {
    set((s) => ({ config: { ...s.config, ...patch } }));
  },

  save: async () => {
    await persistSet(PERSIST_KEY, get().config);
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
```

---

### Step 2：创建 `src/lib/ai.ts`

```typescript
/**
 * LLM 调用封装
 * 支持 OpenAI 兼容接口（OpenAI / DeepSeek / Ollama / custom）
 */
import type { AiConfig } from "@/store/aiStore";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CompletionOptions {
  stream?: boolean;
}

/** 非流式调用，返回完整文本 */
export async function aiComplete(
  userPrompt: string,
  systemPrompt: string,
  config: AiConfig,
  options: CompletionOptions = {}
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.api_key) {
    headers["Authorization"] = `Bearer ${config.api_key}`;
  }

  const response = await fetch(`${config.base_url}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      stream: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`LLM API 错误 ${response.status}：${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("LLM 返回格式异常，未找到 choices[0].message.content");
  }
  return content;
}

/** 流式调用，通过回调逐字符推送 */
export async function aiStream(
  userPrompt: string,
  systemPrompt: string,
  config: AiConfig,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.api_key) {
    headers["Authorization"] = `Bearer ${config.api_key}`;
  }

  const response = await fetch(`${config.base_url}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      stream: true,
    }),
    signal: signal ?? AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`LLM API 错误 ${response.status}：${body.slice(0, 200)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const payload = trimmed.slice(6);
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) onChunk(delta);
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
}

/**
 * HTML 预处理：去除 script/style 内容，截取前 200 行
 * 减少送给 LLM 的 token 量，降低成本
 */
export function preprocessHtml(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "<script>…</script>")
    .replace(/<style[\s\S]*?<\/style>/gi, "<style>…</style>");
  const lines = stripped.split("\n");
  if (lines.length <= 200) return stripped;
  return lines.slice(0, 200).join("\n") + `\n<!-- 已截断，共 ${lines.length} 行 -->`;
}

/**
 * 从 LLM 回复中提取 JSON 块
 * 兜底：LLM 偶尔在 JSON 外包裹 markdown 代码块
 */
export function extractJson(text: string): unknown {
  // 优先尝试直接解析
  try { return JSON.parse(text); } catch { /* continue */ }
  // 提取 ```json ... ``` 块
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch { /* continue */ }
  }
  // 提取第一个 { ... } 块
  const brace = text.match(/\{[\s\S]+\}/);
  if (brace) {
    try { return JSON.parse(brace[0]); } catch { /* continue */ }
  }
  throw new Error(`无法从 LLM 回复中提取 JSON：${text.slice(0, 100)}`);
}

/** XPath 本地验证：在浏览器内执行并收集匹配样本 */
export function validateXPath(
  html: string,
  xpath: string
): { count: number; samples: string[]; error?: string } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const result = document.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    const samples: string[] = [];
    let node = result.iterateNext();
    let count = 0;
    while (node && samples.length < 5) {
      count++;
      const text = (node.textContent ?? (node as Attr).value ?? "").trim().slice(0, 60);
      if (text) samples.push(text);
      node = result.iterateNext();
    }
    // count only includes nodes we iterated; re-count with UNORDERED_SNAPSHOT for accuracy
    const snapshot = document.evaluate(xpath, doc, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
    return { count: snapshot.snapshotLength, samples };
  } catch (e) {
    return { count: -1, samples: [], error: `XPath 语法错误：${String(e)}` };
  }
}
```

---

### Step 3：创建 `src/pages/settings/sections/AiSection.tsx`

```tsx
import { useEffect } from "react";
import { Sparkles, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Toggle } from "@/components/Toggle";
import { useAiStore, AI_PROVIDER_PRESETS, type AiProvider } from "@/store/aiStore";

const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai:   "OpenAI",
  deepseek: "DeepSeek（推荐，性价比高）",
  ollama:   "Ollama（本地模型）",
  custom:   "自定义",
};

export function AiSection() {
  const { config, loaded, load, update, save, testConnection, testStatus, testMessage } = useAiStore();
  const [showKey, setShowKey] = useState(false);

  useEffect(() => { if (!loaded) load(); }, [loaded, load]);

  const handleProviderChange = (provider: AiProvider) => {
    const preset = AI_PROVIDER_PRESETS[provider];
    update({ ...preset, provider });
  };

  const handleChange = (field: keyof typeof config, value: string | number | boolean) => {
    update({ [field]: value });
    // debounce save
    clearTimeout((handleChange as unknown as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleChange as unknown as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => save(), 600);
  };

  return (
    <Card
      title="AI 助手"
      actions={
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {config.enabled ? "已启用" : "已关闭"}
          </span>
          <Toggle
            checked={config.enabled}
            onChange={(v) => { update({ enabled: v }); save(); }}
          />
        </div>
      }
    >
      {!config.enabled ? (
        <div className="flex items-center gap-3 py-2">
          <Sparkles className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-subtle)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            启用 AI 助手后，可在源码查看器和网站配置中使用智能 XPath 生成功能。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Provider */}
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              服务商
            </label>
            <select
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              value={config.provider}
              onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
            >
              {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((p) => (
                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
              ))}
            </select>
          </div>

          {/* Base URL */}
          <div className="col-span-2">
            <Input
              label="Base URL"
              value={config.base_url}
              placeholder="https://api.openai.com/v1"
              onChange={(e) => handleChange("base_url", e.target.value)}
            />
          </div>

          {/* API Key */}
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              API Key
              <span className="ml-1.5 font-normal" style={{ color: "var(--color-text-subtle)" }}>
                （仅存本地，不写入配置文件）
              </span>
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={config.api_key}
                onChange={(e) => handleChange("api_key", e.target.value)}
                placeholder={config.provider === "ollama" ? "Ollama 无需 Key" : "sk-..."}
                className="w-full border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none"
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-accent)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded transition-opacity hover:opacity-70"
                style={{ color: "var(--color-text-subtle)" }}
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Model */}
          <div>
            <Input
              label="模型名称"
              value={config.model}
              placeholder="gpt-4o-mini"
              onChange={(e) => handleChange("model", e.target.value)}
            />
          </div>

          {/* Max tokens */}
          <div>
            <Input
              label="最大 Token 数"
              type="number"
              value={String(config.max_tokens)}
              onChange={(e) => handleChange("max_tokens", parseInt(e.target.value, 10) || 2048)}
            />
          </div>

          {/* Test connection */}
          <div className="col-span-2 flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={testConnection}
              disabled={testStatus === "testing"}
            >
              {testStatus === "testing"
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Sparkles className="w-3.5 h-3.5" />}
              {testStatus === "testing" ? "测试中..." : "测试连接"}
            </Button>
            {testStatus === "ok" && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-success)" }}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {testMessage}
              </span>
            )}
            {testStatus === "error" && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-danger)" }}>
                <XCircle className="w-3.5 h-3.5" />
                {testMessage}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
```

---

### Step 4：在 `src/pages/settings/SettingsPage.tsx` 引入 AiSection

在 `import { AdvancedNetworkSection }` 后追加：
```typescript
import { AiSection } from "./sections/AiSection";
```

在 `<AdvancedNetworkSection />` 后追加：
```tsx
<AiSection />
```

---

### Step 5：验证

运行 `pnpm run build`，确认无 TypeScript 错误。进入设置页，"AI 助手" Card 可见，打开开关后可配置 DeepSeek，测试连接返回成功。

---

---

## Task 2：源码查看器 AI 增强

**Files:**
- 修改：`src/components/SourceViewer.tsx`

在现有 SourceViewer 组件内增加折叠式 AI 分析面板。当 AI 未配置时，面板显示引导语提示去设置。

---

### Step 1：在 SourceViewer.tsx 顶部增加 AI 相关 imports

在现有 imports 后追加：

```typescript
import { Sparkles, ChevronUp, AlertCircle } from "lucide-react";
import { useAiStore } from "@/store/aiStore";
import { aiComplete, preprocessHtml, extractJson, validateXPath } from "@/lib/ai";
```

---

### Step 2：在 SourceViewer 内部增加 AI 状态

在现有 `const [copied, setCopied] = useState(false);` 后追加：

```typescript
// ── AI panel state ────────────────────────────────────────────────
const [aiOpen, setAiOpen] = useState(false);
const [aiIntent, setAiIntent] = useState("");
const [aiLoading, setAiLoading] = useState(false);
const [aiResult, setAiResult] = useState<{
  xpath: string;
  explanation: string;
  alternatives: string[];
  validation: { count: number; samples: string[]; error?: string } | null;
} | null>(null);
const [aiError, setAiError] = useState<string | null>(null);
const aiAbortRef = useRef<AbortController | null>(null);
const { config: aiConfig } = useAiStore();
```

---

### Step 3：添加 AI 分析逻辑函数

在 `fetchSource` 函数后追加：

```typescript
const INTENT_PRESETS = [
  "书名列表（列表页）",
  "更新日期",
  "章节目录链接",
  "正文内容",
  "详情页书名",
];

const AI_SYSTEM_PROMPT = `你是专门分析中文小说网站 HTML 结构的专家。用户会给你 HTML 源码和提取目标。
你的任务是生成精确的 XPath 表达式。

规则：
1. 优先使用 id 或 class 属性定位，避免纯位置 XPath
2. 提取文本用 /text()，提取属性用 /@href 等
3. 优先生成 // 开头的全局路径
4. 输出严格 JSON，不含其他内容：
{"xpath":"...","explanation":"...","alternatives":["..."]}`;

const runAiAnalysis = async () => {
  if (!aiConfig.enabled || !aiConfig.base_url || !aiIntent.trim() || !html) return;

  aiAbortRef.current?.abort();
  aiAbortRef.current = new AbortController();

  setAiLoading(true);
  setAiResult(null);
  setAiError(null);

  try {
    const processedHtml = preprocessHtml(html);
    const userPrompt = `目标：${aiIntent}\n\nHTML：\n${processedHtml}`;

    const raw = await aiComplete(userPrompt, AI_SYSTEM_PROMPT, aiConfig);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = extractJson(raw) as any;

    const xpath: string = parsed?.xpath ?? "";
    const explanation: string = parsed?.explanation ?? "";
    const alternatives: string[] = Array.isArray(parsed?.alternatives)
      ? parsed.alternatives.filter((x: unknown) => typeof x === "string")
      : [];

    const validation = xpath ? validateXPath(html, xpath) : null;

    setAiResult({ xpath, explanation, alternatives, validation });
    if (xpath) setGeneratedXPath(xpath);
  } catch (e) {
    if ((e as Error).name !== "AbortError") {
      setAiError(String(e));
    }
  } finally {
    setAiLoading(false);
  }
};
```

---

### Step 4：在工具栏的 Search row 后插入 AI 面板

在现有 search row `</div>` 闭合后（工具栏 border-b 的 `</div>` 之前）插入 AI 折叠区块：

**位置标识：** 找到工具栏中 `</div>` 紧接 `{/* ── Main content */}` 注释之前的位置，在工具栏最后一行插入以下整块 JSX：

```tsx
{/* ── AI panel ──────────────────────────────── */}
{aiConfig.enabled && (
  <div style={{ borderTop: "1px solid var(--color-border)" }}>
    {/* Toggle header */}
    <button
      className="w-full flex items-center gap-2 px-4 py-2 text-left transition-colors hover:opacity-80"
      style={{ background: "transparent" }}
      onClick={() => setAiOpen((v) => !v)}
    >
      <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
      <span className="flex-1 text-xs font-medium" style={{ color: "var(--color-accent)" }}>
        AI 分析
      </span>
      <ChevronUp
        className="w-3.5 h-3.5 transition-transform"
        style={{
          color: "var(--color-text-muted)",
          transform: aiOpen ? "rotate(0deg)" : "rotate(180deg)",
        }}
      />
    </button>

    {aiOpen && (
      <div className="px-4 pb-3 flex flex-col gap-2.5">
        {/* Intent quick presets */}
        <div className="flex flex-wrap gap-1.5">
          {INTENT_PRESETS.map((preset) => (
            <button
              key={preset}
              className="text-xs px-2.5 py-1 rounded-full border transition-all hover:opacity-80"
              style={{
                background: aiIntent === preset ? "var(--color-accent-muted)" : "var(--color-surface)",
                borderColor: aiIntent === preset ? "var(--color-accent)" : "var(--color-border)",
                color: aiIntent === preset ? "var(--color-accent)" : "var(--color-text-muted)",
              }}
              onClick={() => setAiIntent(preset)}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Intent input + run */}
        <div className="flex gap-2">
          <input
            type="text"
            value={aiIntent}
            onChange={(e) => setAiIntent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runAiAnalysis()}
            placeholder="描述你要提取什么，例如：列表页每本书的链接"
            className="flex-1 border rounded-lg px-3 py-1.5 text-xs focus:outline-none"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-accent)";
              e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "var(--color-accent)",
              color: "#fff",
              boxShadow: "var(--shadow-accent)",
            }}
            onClick={runAiAnalysis}
            disabled={aiLoading || !html || !aiIntent.trim()}
          >
            {aiLoading
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Sparkles className="w-3 h-3" />}
            {aiLoading ? "分析中..." : "分析"}
          </button>
        </div>

        {/* Error */}
        {aiError && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}

        {/* Result */}
        {aiResult && (
          <div className="flex flex-col gap-2 p-3 rounded-xl border"
            style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}>
            {/* XPath */}
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono truncate"
                style={{ color: "var(--color-accent)" }}
                title={aiResult.xpath}>
                {aiResult.xpath}
              </code>
            </div>

            {/* Validation badge */}
            {aiResult.validation && (
              <div className="flex items-center gap-1.5">
                {aiResult.validation.error ? (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
                    语法错误
                  </span>
                ) : aiResult.validation.count === 0 ? (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}>
                    命中 0 个，可能不适用当前页面
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
                    命中 {aiResult.validation.count} 个
                  </span>
                )}
                {aiResult.validation.samples.length > 0 && (
                  <span className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                    样本：{aiResult.validation.samples.slice(0, 3).join("、")}
                  </span>
                )}
              </div>
            )}

            {/* Explanation */}
            {aiResult.explanation && (
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {aiResult.explanation}
              </p>
            )}

            {/* Alternatives */}
            {aiResult.alternatives.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>备选：</span>
                {aiResult.alternatives.map((alt) => (
                  <button
                    key={alt}
                    className="text-xs px-2 py-0.5 rounded border hover:opacity-80 transition-opacity font-mono"
                    style={{
                      background: "var(--color-surface)",
                      borderColor: "var(--color-border)",
                      color: "var(--color-text-muted)",
                    }}
                    onClick={() => {
                      setGeneratedXPath(alt);
                      const v = validateXPath(html, alt);
                      setAiResult((r) => r ? { ...r, xpath: alt, validation: v } : r);
                    }}
                  >
                    {alt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )}
  </div>
)}
```

---

### Step 5：AI 未启用时，在工具栏 AI panel 位置显示引导提示

将 `{aiConfig.enabled && (` 改为条件渲染，当 `!aiConfig.enabled` 时展示一行静默提示：

```tsx
{!aiConfig.enabled && html && (
  <div className="px-4 py-2 flex items-center gap-2"
    style={{ borderTop: "1px solid var(--color-border)" }}>
    <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-subtle)" }} />
    <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
      在设置页启用 AI 助手可自动生成 XPath
    </span>
  </div>
)}
```

---

### Step 6：验证

构建通过后，打开源码查看器，获取一个真实页面源码，展开 AI 面板，点击"书名列表（列表页）"预设，点击"分析"，确认返回 XPath 并显示命中数和样本。

---

---

## Task 3：网站编辑器 AI 批量 XPath 分析

**Files:**
- 创建：`src/components/AiXPathAnalyzer.tsx`
- 修改：`src/pages/WebsitesPage.tsx`（WebsiteEditor 组件内集成）

点击一个按钮，AI 同时分析全部 6 个 XPath 字段，结果以对比卡片展示，每个字段独立选择采用。

---

### Step 1：创建 `src/components/AiXPathAnalyzer.tsx`

**6 个字段定义：**

```typescript
const XPATH_FIELD_LABELS: Array<{
  key: keyof Pick<WebsiteConfig,
    "list_novel_name" | "release_date" | "release_url" |
    "novel_name_x" | "chapter_url_x" | "novel_content">;
  label: string;
  hint: string;
}> = [
  { key: "list_novel_name", label: "列表页书名",   hint: "列表页中每本书的标题" },
  { key: "release_date",    label: "更新日期",     hint: "每本书的最新更新时间" },
  { key: "release_url",     label: "书目链接",     hint: "进入详情/目录页的 href" },
  { key: "novel_name_x",    label: "详情页书名",   hint: "目录页中的书名标题" },
  { key: "chapter_url_x",   label: "章节链接",     hint: "目录页中各章节的 href" },
  { key: "novel_content",   label: "正文内容",     hint: "章节阅读页的正文文字" },
];
```

**组件 props：**

```typescript
interface AiXPathAnalyzerProps {
  site: WebsiteConfig;
  onApply: (patch: Partial<WebsiteConfig>) => void;
  onClose: () => void;
}
```

**完整组件实现：**

```tsx
import { useState, useEffect } from "react";
import { Sparkles, Loader2, Check, X, AlertCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/Button";
import { useAiStore } from "@/store/aiStore";
import { apiFetchSource } from "@/lib/api/files";
import { aiComplete, preprocessHtml, extractJson, validateXPath } from "@/lib/ai";
import type { WebsiteConfig } from "@/types";

// XPATH_FIELD_LABELS 定义如上

type FieldKey = typeof XPATH_FIELD_LABELS[number]["key"];

interface FieldResult {
  key: FieldKey;
  label: string;
  currentValue: string;
  suggested: string;
  explanation: string;
  validation: { count: number; samples: string[]; error?: string } | null;
  adopted: boolean;
}

const AI_BATCH_SYSTEM = `你是专门分析中文小说网站 HTML 结构的专家。
一次性分析给定字段，输出严格 JSON，不含其他内容：
{
  "list_novel_name": {"xpath":"...","explanation":"..."},
  "release_date":    {"xpath":"...","explanation":"..."},
  "release_url":     {"xpath":"...","explanation":"..."},
  "novel_name_x":    {"xpath":"...","explanation":"..."},
  "chapter_url_x":   {"xpath":"...","explanation":"..."},
  "novel_content":   {"xpath":"...","explanation":"..."}
}
规则：优先用 id/class 属性，文本加 /text()，链接加 /@href，用 // 全局路径。
无把握的字段 xpath 留空字符串。`;

export function AiXPathAnalyzer({ site, onApply, onClose }: AiXPathAnalyzerProps) {
  const { config: aiConfig } = useAiStore();
  const [phase, setPhase] = useState<"idle" | "fetching" | "analyzing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<FieldResult[]>([]);
  const [html, setHtml] = useState("");

  const startAnalysis = async () => {
    if (!site.domain_name || !aiConfig.enabled) return;
    setPhase("fetching");
    setErrorMsg("");
    try {
      const raw = await apiFetchSource(site.domain_name);
      setHtml(raw);
      setPhase("analyzing");

      const processed = preprocessHtml(raw);
      const userPrompt = `网站：${site.domain_name}\n\n分析以下 HTML，为 6 个字段生成 XPath：\n${processed}`;
      const reply = await aiComplete(userPrompt, AI_BATCH_SYSTEM, aiConfig);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(reply) as any;

      const fieldResults: FieldResult[] = XPATH_FIELD_LABELS.map(({ key, label }) => {
        const item = parsed?.[key] ?? {};
        const xpath: string = item.xpath ?? "";
        const explanation: string = item.explanation ?? "";
        const validation = (xpath && raw) ? validateXPath(raw, xpath) : null;
        return {
          key, label,
          currentValue: (site[key] as string) ?? "",
          suggested: xpath,
          explanation,
          validation,
          adopted: !!xpath,
        };
      });

      setResults(fieldResults);
      setPhase("done");
    } catch (e) {
      setErrorMsg(String(e));
      setPhase("error");
    }
  };

  const toggleAdopt = (key: FieldKey) => {
    setResults((prev) => prev.map((r) => r.key === key ? { ...r, adopted: !r.adopted } : r));
  };

  const applySelected = () => {
    const patch: Partial<WebsiteConfig> = {};
    for (const r of results) {
      if (r.adopted && r.suggested) {
        (patch as Record<string, string>)[r.key] = r.suggested;
      }
    }
    onApply(patch);
    onClose();
  };

  const adoptedCount = results.filter((r) => r.adopted && r.suggested).length;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border"
      style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: "var(--color-accent)" }} />
        <span className="text-sm font-semibold flex-1" style={{ color: "var(--color-text)" }}>
          AI 批量分析 XPath
        </span>
        <button
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:opacity-70"
          style={{ color: "var(--color-text-muted)" }}
          onClick={onClose}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        AI 将抓取 <code style={{ color: "var(--color-accent)" }}>{site.domain_name}</code> 并自动分析所有 6 个 XPath 字段。
        可逐个选择采用。
      </p>

      {/* Idle / Error states */}
      {(phase === "idle" || phase === "error") && (
        <div className="flex flex-col gap-2">
          {phase === "error" && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          <Button size="sm" onClick={startAnalysis} disabled={!aiConfig.enabled}>
            <Sparkles className="w-3.5 h-3.5" />
            {phase === "error" ? "重新分析" : "开始 AI 分析"}
          </Button>
        </div>
      )}

      {/* Fetching / Analyzing */}
      {(phase === "fetching" || phase === "analyzing") && (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--color-accent)" }} />
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {phase === "fetching" ? "正在获取页面源码..." : "AI 正在分析结构，请稍候..."}
          </span>
        </div>
      )}

      {/* Results */}
      {phase === "done" && results.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            {results.map((r) => (
              <div
                key={r.key}
                className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all"
                style={{
                  background: r.adopted ? "color-mix(in srgb, var(--color-accent) 5%, var(--color-surface))" : "var(--color-surface)",
                  borderColor: r.adopted ? "color-mix(in srgb, var(--color-accent) 40%, transparent)" : "var(--color-border)",
                }}
                onClick={() => r.suggested && toggleAdopt(r.key)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
                    {r.label}
                  </span>
                  {r.suggested ? (
                    <div
                      className="flex items-center justify-center w-4 h-4 rounded-full shrink-0 ml-auto"
                      style={{
                        background: r.adopted ? "var(--color-accent)" : "var(--color-border)",
                        color: r.adopted ? "#fff" : "transparent",
                      }}
                    >
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  ) : (
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}>
                      无法生成
                    </span>
                  )}
                </div>

                {/* Current vs Suggested */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: "var(--color-text-subtle)" }}>当前</div>
                    <code className="text-xs block truncate font-mono"
                      style={{ color: r.currentValue ? "var(--color-text-muted)" : "var(--color-text-subtle)" }}>
                      {r.currentValue || "未设置"}
                    </code>
                  </div>
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: "var(--color-text-subtle)" }}>AI 建议</div>
                    <code className="text-xs block truncate font-mono"
                      style={{ color: r.suggested ? "var(--color-accent)" : "var(--color-text-subtle)" }}>
                      {r.suggested || "—"}
                    </code>
                  </div>
                </div>

                {/* Validation */}
                {r.validation && r.suggested && (
                  <div className="flex items-center gap-1.5">
                    {r.validation.error ? (
                      <span className="text-xs" style={{ color: "var(--color-danger)" }}>
                        XPath 语法错误
                      </span>
                    ) : (
                      <>
                        <span className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{
                            background: r.validation.count > 0 ? "var(--color-success-bg)" : "var(--color-warning-bg)",
                            color: r.validation.count > 0 ? "var(--color-success)" : "var(--color-warning)",
                          }}>
                          命中 {r.validation.count} 个
                        </span>
                        {r.validation.samples.length > 0 && (
                          <span className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                            {r.validation.samples.slice(0, 2).join("、")}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}

                {r.explanation && (
                  <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                    {r.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Apply button */}
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={applySelected} disabled={adoptedCount === 0}>
              <ChevronRight className="w-3.5 h-3.5" />
              应用已选字段（{adoptedCount} 个）
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              取消
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
```

---

### Step 2：在 WebsitesPage.tsx 的 WebsiteEditor 中集成

**2a.** 在 WebsiteEditor 的 imports 中追加：
```typescript
import { AiXPathAnalyzer } from "@/components/AiXPathAnalyzer";
import { useAiStore } from "@/store/aiStore";
```

**2b.** 在 WebsiteEditor 函数内，`showSourceViewer` state 后追加：
```typescript
const [showAiAnalyzer, setShowAiAnalyzer] = useState(false);
const { config: aiConfig } = useAiStore();
```

**2c.** 在操作按钮区（现有"套用规则模板"和"源码查看器"按钮旁），当 `!showTemplates` 时追加第三个按钮：
```tsx
{aiConfig.enabled && (
  <button
    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
    style={{
      background: "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))",
      borderColor: "color-mix(in srgb, var(--color-accent) 30%, transparent)",
      color: "var(--color-accent)",
    }}
    onClick={() => setShowAiAnalyzer((v) => !v)}
  >
    <Sparkles className="w-3.5 h-3.5" />
    AI 分析此站点
  </button>
)}
```

**2d.** 在 RuleTemplateSelector 条件渲染区块之后，col-span-2 字段区之前，插入：
```tsx
{showAiAnalyzer && (
  <div className="col-span-2">
    <AiXPathAnalyzer
      site={site}
      onApply={(patch) => onChange({ ...site, ...patch })}
      onClose={() => setShowAiAnalyzer(false)}
    />
  </div>
)}
```

**2e.** 在 WebsitesPage.tsx 顶部 imports 中追加 Sparkles：
```typescript
import { ..., Sparkles } from "lucide-react";
```

---

### Step 3：验证

构建通过后，打开任意网站配置，展开编辑器，启用 AI 后能看到"AI 分析此站点"按钮。点击后显示分析器面板，获取源码→AI 分析→展示对比卡片，选择字段→点击"应用"→字段被更新。

---

## 执行顺序

1. Task 1（AI 配置基础设施）— `aiStore.ts` + `lib/ai.ts` + `AiSection.tsx` + 接入设置页
2. Task 2（源码查看器 AI 增强）— 依赖 Task 1 的 store 和 lib/ai
3. Task 3（批量分析组件）— 依赖 Task 1 + Task 2 的复用逻辑

每个 Task 完成后运行 `pnpm run build` 验证无类型错误。

---

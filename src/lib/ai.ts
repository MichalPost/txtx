/**
 * LLM 调用封装
 *
 * 调用链（与 medrecai 结构对应）：
 * - Tauri 模式：前端 invoke → Rust ai.rs → async-openai → LLM
 * - HTTP 模式：前端 fetch → Rust /api/ai/* 路由 → async-openai → LLM
 *
 * 前端不直接接触 LLM API，所有调用都经过 Rust 后端，
 * 和 medrecai 的 前端 → FastAPI → Python openai SDK → LLM 完全对应。
 */
import { API_BASE, IS_TAURI } from "@/lib/api/constants";
import type { AiConfig } from "@/store/aiStore";

// ─── Request / response types（镜像 Rust 结构体）─────────────────────────────

interface AiCompleteRequest {
  config: {
    base_url: string;
    api_key: string;
    model: string;
    max_tokens: number;
    temperature: number;
  };
  system_prompt: string;
  user_prompt: string;
}

function buildRequest(
  userPrompt: string,
  systemPrompt: string,
  config: AiConfig,
): AiCompleteRequest {
  return {
    config: {
      base_url: config.base_url,
      api_key: config.api_key,
      model: config.model,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
    },
    system_prompt: systemPrompt,
    user_prompt: userPrompt,
  };
}

// ─── Non-streaming completion ──────────────────────────────────────────────────

/**
 * 非流式调用，返回完整文本。
 *
 * Tauri 模式：invoke("ai_complete") → Rust ai::complete() → async-openai
 * HTTP 模式： POST /api/ai/complete → Rust post_ai_complete() → async-openai
 */
export async function aiComplete(
  userPrompt: string,
  systemPrompt: string,
  config: AiConfig,
): Promise<string> {
  const request = buildRequest(userPrompt, systemPrompt, config);

  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    const res = await invoke<{ text: string }>("ai_complete", { request });
    return res.text;
  }

  const response = await fetch(`${API_BASE}/api/ai/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`AI 请求失败 ${response.status}：${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as { text: string };
  return data.text;
}

// ─── Streaming completion ──────────────────────────────────────────────────────

/**
 * 流式调用，通过回调逐 token 推送。
 *
 * Tauri 模式：invoke("ai_stream_complete") + listen("ai_token") event
 * HTTP 模式： POST /api/ai/stream → Rust SSE → 逐行解析 data: {token}
 *
 * Rust 后端的 stream_with_callback() 使用 async-openai stream，
 * 和 medrecai 的 _stream_candidate(stream=True) 逐 chunk 收集是同一思路。
 */
export async function aiStream(
  userPrompt: string,
  systemPrompt: string,
  config: AiConfig,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const request = buildRequest(userPrompt, systemPrompt, config);

  if (IS_TAURI) {
    await _tauriStream(request, onChunk, signal);
    return;
  }

  await _httpStream(request, onChunk, signal);
}

async function _tauriStream(
  request: AiCompleteRequest,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");

  const streamId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    let unlisten: (() => void) | null = null;
    let settled = false;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      unlisten?.();
      if (err) reject(err);
      else resolve();
    };

    listen<{ stream_id: string; token: string | null; done: boolean; error: string | null }>(
      "ai_token",
      (event) => {
        const p = event.payload;
        if (p.stream_id !== streamId) return;
        if (p.error) {
          finish(new Error(p.error));
          return;
        }
        if (p.done) {
          finish();
          return;
        }
        if (p.token != null) onChunk(p.token);
      },
    )
      .then((fn) => {
        unlisten = fn;
        signal?.addEventListener("abort", () => finish(new Error("Aborted")));
        if (signal?.aborted) {
          finish(new Error("Aborted"));
          return;
        }
        invoke("ai_stream_complete", { request, streamId }).catch((e: unknown) => {
          finish(new Error(String(e)));
        });
      })
      .catch(reject);
  });
}

async function _httpStream(
  request: AiCompleteRequest,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/ai/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: signal ?? AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`AI 流式请求失败 ${response.status}：${body.slice(0, 200)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") return;
        if (payload.startsWith("[ERROR] ")) {
          throw new Error(payload.slice(8));
        }
        // Rust 后端对 token 中的换行做了转义，这里还原
        const token = payload.replace(/\\n/g, "\n");
        if (token) onChunk(token);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Structured extraction (kumo mode) ────────────────────────────────────────

/**
 * kumo 模式：传入 JSON Schema + 原始 HTML，后端用 kumo LlmClient bridge 直接
 * 提取结构化内容，返回类型安全的 JSON 对象。
 *
 * 与 aiComplete + extractJson 的区别：
 * - 这里 prompt 由 Rust 侧 kumo 自动生成（清理 HTML、套 schema 约束）
 * - LLM 被强制以 JSON Schema 格式返回，不会出现 markdown 乱格式
 */
export async function aiExtract<T = Record<string, unknown>>(
  html: string,
  schema: Record<string, unknown>,
  config: AiConfig,
): Promise<T> {
  const configPayload = {
    base_url: config.base_url,
    api_key: config.api_key,
    model: config.model,
    max_tokens: config.max_tokens,
    temperature: config.temperature,
  };

  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    const res = await invoke<{ data: T }>("ai_extract", {
      request: { config: configPayload, schema, html },
    });
    return res.data;
  }

  const response = await fetch(`${API_BASE}/api/ai/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config: configPayload, schema, html }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`AI 提取请求失败 ${response.status}：${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as { data: T };
  return data.data;
}

// ─── HTML preprocessing ────────────────────────────────────────────────────────

/**
 * 去除 script/style 内容，截取前 200 行（减少送给 LLM 的 token 量）
 */
export function preprocessHtml(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "<script>…</script>")
    .replace(/<style[\s\S]*?<\/style>/gi, "<style>…</style>");
  const lines = stripped.split("\n");
  if (lines.length <= 200) return stripped;
  return lines.slice(0, 200).join("\n") + `\n<!-- 已截断，共 ${lines.length} 行 -->`;
}

// ─── JSON extraction ───────────────────────────────────────────────────────────

/**
 * 从 LLM 回复中提取 JSON 块
 * LLM 偶尔在 JSON 外包裹 markdown 代码块，这里兜底处理
 */
export function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    /* continue */
  }
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* continue */
    }
  }
  const brace = text.match(/\{[\s\S]+\}/);
  if (brace) {
    try {
      return JSON.parse(brace[0]);
    } catch {
      /* continue */
    }
  }
  throw new Error(`无法从 LLM 回复中提取 JSON：${text.slice(0, 100)}`);
}

// ─── XPath local validation ────────────────────────────────────────────────────

/** 在浏览器内执行 XPath 并收集匹配样本（不依赖后端） */
export function validateXPath(
  html: string,
  xpath: string,
): { count: number; samples: string[]; error?: string } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const samples: string[] = [];
    const snapshot = document.evaluate(
      xpath,
      doc,
      null,
      XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
      null,
    );
    for (let i = 0; i < Math.min(snapshot.snapshotLength, 5); i++) {
      const node = snapshot.snapshotItem(i);
      const text = (node?.textContent ?? (node as Attr | null)?.value ?? "").trim().slice(0, 60);
      if (text) samples.push(text);
    }
    return { count: snapshot.snapshotLength, samples };
  } catch (e) {
    return { count: -1, samples: [], error: `XPath 语法错误：${String(e)}` };
  }
}

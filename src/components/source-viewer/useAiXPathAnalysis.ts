/**
 * useAiXPathAnalysis — SourceViewer 的 AI 分析状态和逻辑
 */
import { useRef, useState } from "react";

import { aiComplete, extractJson, preprocessHtml, validateXPath } from "@/lib/ai";
import { useAiStore } from "@/store/aiStore";

export interface AiXPathResult {
  xpath: string;
  explanation: string;
  alternatives: string[];
  validation: { count: number; samples: string[]; error?: string } | null;
}

const AI_SYSTEM_PROMPT = `你是专门分析中文小说网站 HTML 结构的专家。用户会给你 HTML 源码和提取目标。
你的任务是生成精确的 XPath 表达式。

规则：
1. 优先使用 id 或 class 属性定位，避免纯位置 XPath
2. 提取文本用 /text()，提取属性用 /@href 等
3. 优先生成 // 开头的全局路径
4. 输出严格 JSON，不含其他内容：
{"xpath":"...","explanation":"...","alternatives":["..."]}`;

export const INTENT_PRESETS = [
  "书名列表（列表页）",
  "更新日期",
  "章节目录链接",
  "正文内容",
  "详情页书名",
];

export function useAiXPathAnalysis(html: string) {
  const aiAbortRef = useRef<AbortController | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiIntent, setAiIntent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiXPathResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const runAiAnalysis = async () => {
    const aiConfig = useAiStore.getState().activeConfig();
    if (!aiConfig.enabled || !aiConfig.base_url || !aiIntent.trim() || !html) return;

    aiAbortRef.current?.abort();
    aiAbortRef.current = new AbortController();

    setAiLoading(true);
    setAiResult(null);
    setAiError(null);

    try {
      const processedHtml = preprocessHtml(html);
      const userPrompt = `目标：${aiIntent}\n\nHTML：\n${processedHtml}`;
      const raw = await aiComplete(userPrompt, AI_SYSTEM_PROMPT, aiConfig, aiAbortRef.current.signal);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = extractJson(raw) as any;
      const xpath: string = parsed?.xpath ?? "";
      const explanation: string = parsed?.explanation ?? "";
      const alternatives: string[] = Array.isArray(parsed?.alternatives)
        ? parsed.alternatives.filter((x: unknown) => typeof x === "string")
        : [];
      const validation = xpath ? validateXPath(html, xpath) : null;
      setAiResult({ xpath, explanation, alternatives, validation });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setAiError(String(e));
      }
    } finally {
      setAiLoading(false);
    }
  };

  return {
    aiOpen,
    setAiOpen,
    aiIntent,
    setAiIntent,
    aiLoading,
    aiResult,
    setAiResult,
    aiError,
    runAiAnalysis,
  };
}

/**
 * 共用 AI 辅助工具 — WizardStep1/StepCatalog/Step2ListRules 共用
 */
import type { FieldRule } from "../ruleUtils";

/** AI 分析结果中提取的字段结构 */
export interface AiFieldResult {
  xpath?: string;
  explanation?: string;
}

/** 将 AI 返回的 xpath 合并到现有 FieldRule（xpath 为空则保留原值） */
export function applyAiResult(existing: FieldRule, result?: AiFieldResult): FieldRule {
  const xpath = result?.xpath ?? "";
  if (!xpath) return existing;
  return { ...existing, mode: "ai", xpath };
}

/** 公共 AI system prompt — 目录/列表页三字段 XPath 分析 */
export const AI_SYSTEM_LIST_FIELDS = `你是专门分析中文小说网站 HTML 结构的专家。
分析列表/目录页HTML，为以下3个字段生成XPath，严格输出JSON，不含其他内容：
{
  "list_novel_name":   {"xpath":"...","explanation":"..."},
  "list_release_date": {"xpath":"...","explanation":"..."},
  "list_release_url":  {"xpath":"...","explanation":"..."}
}
规则：优先用 id/class 属性，文本加 /text()，链接加 /@href，用 // 全局路径。无把握的字段 xpath 留空字符串。`;

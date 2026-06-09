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

/** AI system prompt — 更新列表页三字段 XPath 分析（书名/书籍链接/更新日期） */
export const AI_SYSTEM_LIST_FIELDS = `你是专门分析中文小说网站 HTML 结构的专家。
分析【最近更新列表页】HTML，页面列出的是多本书的更新信息。为以下3个字段生成XPath，严格输出JSON，不含其他内容：
{
  "list_novel_name":   {"xpath":"...","explanation":"..."},
  "list_release_date": {"xpath":"...","explanation":"..."},
  "list_release_url":  {"xpath":"...","explanation":"..."}
}
字段说明：
- list_novel_name：每本书的【书名】（不是章节名）
- list_release_date：每本书的【最近更新日期】
- list_release_url：每本书的【书籍目录页链接】（不是章节链接）
规则：优先用 id/class 属性，文本加 /text()，链接加 /@href，用 // 全局路径。无把握的字段 xpath 留空字符串。`;

/** AI system prompt — 目录页（章节列表）三字段 XPath 分析（章节名/章节链接/更新日期） */
export const AI_SYSTEM_CATALOG_FIELDS = `你是专门分析中文小说网站 HTML 结构的专家。
分析【小说目录页】HTML，页面列出的是某本书的所有章节列表。为以下3个字段生成XPath，严格输出JSON，不含其他内容：
{
  "list_novel_name":   {"xpath":"...","explanation":"..."},
  "list_release_date": {"xpath":"...","explanation":"..."},
  "list_release_url":  {"xpath":"...","explanation":"..."}
}
字段说明：
- list_novel_name：每个章节条目的【章节标题/章节名称】（不是书名，是章节名）
- list_release_date：每个章节的【更新日期】（可能没有，留空）
- list_release_url：每个章节条目的【章节页面链接】（不是书籍链接，是章节链接）
规则：优先用 id/class 属性，文本加 /text()，链接加 /@href，用 // 全局路径。无把握的字段 xpath 留空字符串。`;

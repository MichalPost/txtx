import type { WebsiteConfig } from "@/types";

import {
  getAiFieldResult,
  getAiObject,
  getAiString,
} from "./rule-wizard/utils/aiResponse.ts";

const XPATH_FIELD_KEYS = [
  "list_novel_name",
  "release_date",
  "release_url",
  "novel_name_x",
  "chapter_url_x",
  "novel_content",
] as const;

type FieldKey = (typeof XPATH_FIELD_KEYS)[number];

export interface AiXPathAnalysisResult {
  key: FieldKey;
  suggested: string;
  explanation: string;
}

export function parseAiXPathAnalysis(
  parsed: unknown,
  extracted: Record<string, unknown> | null | undefined,
): AiXPathAnalysisResult[] {
  const batchResult = getAiObject(parsed);

  return XPATH_FIELD_KEYS.map((key) => {
    const field = getAiFieldResult(batchResult[key]);
    const extractedValue = getAiString(extracted?.[key]);
    return {
      key,
      suggested: field?.xpath ?? extractedValue,
      explanation: field?.explanation ?? (extractedValue ? "直接从页面提取的内容" : ""),
    };
  });
}

export type AiXPathAnalysisKey = keyof Pick<
  WebsiteConfig,
  | "list_novel_name"
  | "release_date"
  | "release_url"
  | "novel_name_x"
  | "chapter_url_x"
  | "novel_content"
>;

import type { BlacklistConfig } from "../../types";

export interface DraftListFeedback {
  accepted: string[];
  duplicateValues: string[];
  emptyCount: number;
  invalidEntries: string[];
}

export interface BlacklistSummary {
  keywordCount: number;
  regexCount: number;
  tagCount: number;
  enabledFeatureCount: number;
}

function normalizeValue(value: string): string {
  return value.trim();
}

export function splitDraftValues(text: string): string[] {
  return text.split(/[\r\n,，、]+/).map((part) => normalizeValue(part));
}

export function buildDraftListFeedback(
  values: string[],
  existing: string[],
  validator?: (value: string) => boolean,
): DraftListFeedback {
  const seen = new Set(existing);
  const accepted: string[] = [];
  const duplicateValues = new Set<string>();
  const invalidEntries: string[] = [];
  let emptyCount = 0;

  for (const rawValue of values) {
    const value = normalizeValue(rawValue);
    if (!value) {
      emptyCount += 1;
      continue;
    }

    if (validator && !validator(value)) {
      invalidEntries.push(value);
      continue;
    }

    if (seen.has(value)) {
      duplicateValues.add(value);
      continue;
    }

    seen.add(value);
    accepted.push(value);
  }

  return {
    accepted,
    duplicateValues: [...duplicateValues],
    emptyCount,
    invalidEntries,
  };
}

export function isValidRegexPattern(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export function serializeBlacklistDraft(blacklist: BlacklistConfig): string {
  return JSON.stringify(blacklist);
}

export function buildBlacklistSummary(blacklist: BlacklistConfig): BlacklistSummary {
  return {
    keywordCount: blacklist.keywords.length,
    regexCount: blacklist.regex_patterns.length,
    tagCount: blacklist.tag_filter ? (blacklist.filtered_tags?.length ?? 0) : 0,
    enabledFeatureCount: [
      blacklist.enabled,
      blacklist.case_insensitive,
      blacklist.fuzzy_match,
      blacklist.regex_match,
      blacklist.tag_filter,
    ].filter(Boolean).length,
  };
}

export function formatDraftFeedback(
  acceptedCount: number,
  duplicateCount: number,
  emptyCount: number,
  invalidCount = 0,
): string | null {
  const parts: string[] = [];

  if (acceptedCount > 0) {
    parts.push(`新增 ${acceptedCount} 条`);
  }
  if (duplicateCount > 0) {
    parts.push(`跳过 ${duplicateCount} 条重复项`);
  }
  if (emptyCount > 0) {
    parts.push(`忽略 ${emptyCount} 条空白项`);
  }
  if (invalidCount > 0) {
    parts.push(`拦截 ${invalidCount} 条无效项`);
  }

  return parts.length > 0 ? parts.join("，") : null;
}

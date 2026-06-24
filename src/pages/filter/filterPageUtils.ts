import type { AppConfig, BlacklistConfig, ContentFilterConfig } from "../../types";

export interface FilterSaveState {
  dirty: boolean;
  tone: "neutral" | "success" | "warning";
  label: string;
  hint: string;
}

export interface BlacklistTestResult {
  blocked: boolean;
  reason?: string;
  matchedBy?: "whitelist" | "keyword" | "regex";
}

export interface ContentPreviewLine {
  text: string;
  removed: boolean;
  matchedRule?: string;
  isNavStrip?: boolean;
}

export interface ContentFilterPreviewResult {
  lines: ContentPreviewLine[];
  removedCount: number;
  keptCount: number;
  keptRatio: number;
  safetyRollback: boolean;
}

export interface ParsedLineDraft {
  accepted: string[];
  duplicateCount: number;
  emptyCount: number;
}

export interface ParsedRegexLineDraft extends ParsedLineDraft {
  invalidCount: number;
}

export interface FilterImportListPlan {
  accepted: string[];
  duplicateCount: number;
  emptyCount: number;
  invalidCount: number;
}

export interface BlacklistImportPlan {
  keywords: FilterImportListPlan;
  regexPatterns: FilterImportListPlan;
  whitelist: FilterImportListPlan;
  filteredTags: FilterImportListPlan;
}

export interface ContentFilterImportPlan {
  adPatterns: FilterImportListPlan;
  navKeywords: FilterImportListPlan;
}

export function mergeUniqueStrings(current: string[], incoming: string[]): string[] {
  return [...new Set([...current, ...incoming])];
}

export function parseUniqueLineDraft(
  text: string,
  existing: string[] = [],
  splitter: RegExp = /[\r\n,，]+/,
): ParsedLineDraft {
  const accepted: string[] = [];
  const seen = new Set(existing);
  let duplicateCount = 0;
  let emptyCount = 0;

  text.split(splitter).forEach((raw) => {
    const value = raw.trim();
    if (!value) {
      emptyCount += 1;
      return;
    }
    if (seen.has(value)) {
      duplicateCount += 1;
      return;
    }
    seen.add(value);
    accepted.push(value);
  });

  return { accepted, duplicateCount, emptyCount };
}

export function filterStringListByQuery(items: string[], query: string): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;
  return items.filter((item) => item.toLowerCase().includes(normalizedQuery));
}

export function parseRegexLineDraft(
  text: string,
  existing: string[] = [],
  isValidRegex: (pattern: string) => boolean,
): ParsedRegexLineDraft {
  const accepted: string[] = [];
  const seen = new Set(existing);
  let duplicateCount = 0;
  let emptyCount = 0;
  let invalidCount = 0;

  text.split(/[\r\n]+/).forEach((raw) => {
    const value = raw.trim();
    if (!value) {
      emptyCount += 1;
      return;
    }
    if (!isValidRegex(value)) {
      invalidCount += 1;
      return;
    }
    if (seen.has(value)) {
      duplicateCount += 1;
      return;
    }
    seen.add(value);
    accepted.push(value);
  });

  return { accepted, duplicateCount, emptyCount, invalidCount };
}

function readStringArray(value: unknown): { values: string[]; emptyCount: number; invalidCount: number } {
  if (!Array.isArray(value)) {
    return { values: [], emptyCount: 0, invalidCount: 0 };
  }

  const values: string[] = [];
  let emptyCount = 0;
  let invalidCount = 0;
  value.forEach((item) => {
    if (typeof item !== "string") {
      invalidCount += 1;
      return;
    }
    const trimmed = item.trim();
    if (!trimmed) {
      emptyCount += 1;
      return;
    }
    values.push(trimmed);
  });
  return { values, emptyCount, invalidCount };
}

export function buildStringListImportPlan(
  value: unknown,
  existing: string[],
  isValid?: (item: string) => boolean,
): FilterImportListPlan {
  const { values, emptyCount, invalidCount: malformedCount } = readStringArray(value);
  const accepted: string[] = [];
  const seen = new Set(existing);
  let duplicateCount = 0;
  let invalidCount = malformedCount;

  values.forEach((item) => {
    if (isValid && !isValid(item)) {
      invalidCount += 1;
      return;
    }
    if (seen.has(item)) {
      duplicateCount += 1;
      return;
    }
    seen.add(item);
    accepted.push(item);
  });

  return { accepted, duplicateCount, emptyCount, invalidCount };
}

export function buildBlacklistImportPlan(
  input: unknown,
  current: BlacklistConfig,
  isValidRegex: (pattern: string) => boolean,
): BlacklistImportPlan {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  return {
    keywords: buildStringListImportPlan(source.keywords, current.keywords),
    regexPatterns: buildStringListImportPlan(
      source.regex_patterns,
      current.regex_patterns,
      isValidRegex,
    ),
    whitelist: buildStringListImportPlan(source.whitelist, current.whitelist ?? []),
    filteredTags: buildStringListImportPlan(source.filtered_tags, current.filtered_tags ?? []),
  };
}

export function buildContentFilterImportPlan(
  input: unknown,
  current: ContentFilterConfig,
  isValidRegex: (pattern: string) => boolean,
): ContentFilterImportPlan {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  return {
    adPatterns: buildStringListImportPlan(source.ad_patterns, current.ad_patterns, isValidRegex),
    navKeywords: buildStringListImportPlan(source.nav_keywords, current.nav_keywords),
  };
}

export function serializeFilterDraft(value: unknown): string {
  return JSON.stringify(value);
}

export function buildImportSummary(
  acceptedCount: number,
  duplicateCount: number,
  emptyCount: number,
  noun: string,
  invalidCount = 0,
): string | null {
  const parts: string[] = [];

  if (acceptedCount > 0) {
    parts.push(`已导入 ${acceptedCount} 条${noun}`);
  }
  if (duplicateCount > 0) {
    parts.push(`跳过 ${duplicateCount} 条重复项`);
  }
  if (emptyCount > 0) {
    parts.push(`忽略 ${emptyCount} 条空白项`);
  }
  if (invalidCount > 0) {
    parts.push(`跳过 ${invalidCount} 条无效项`);
  }

  return parts.length > 0 ? parts.join("，") : null;
}

interface BuildFilterSaveStateOptions {
  savedSnapshot: string | null;
  currentSnapshot: string;
  saving?: boolean;
  lastSavedAt?: string | null;
}

export function buildFilterSaveState({
  savedSnapshot,
  currentSnapshot,
  saving = false,
  lastSavedAt,
}: BuildFilterSaveStateOptions): FilterSaveState {
  if (saving) {
    return {
      dirty: false,
      tone: "neutral",
      label: "保存中...",
      hint: "正在写入当前过滤配置。",
    };
  }

  if (!savedSnapshot || savedSnapshot !== currentSnapshot) {
    return {
      dirty: true,
      tone: "warning",
      label: "有未保存更改",
      hint: "请保存后再离开或继续测试导出。",
    };
  }

  if (lastSavedAt) {
    return {
      dirty: false,
      tone: "success",
      label: "已保存",
      hint: `最近一次保存于 ${lastSavedAt}`,
    };
  }

  return {
    dirty: false,
    tone: "neutral",
    label: "已同步",
    hint: "当前过滤配置与已保存版本一致。",
  };
}

export function formatSavedAt(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export function mergeFilterConfigDrafts(
  config: AppConfig,
  drafts: {
    blacklist?: BlacklistConfig;
    content_filter?: ContentFilterConfig;
  },
): AppConfig {
  return {
    ...config,
    blacklist: drafts.blacklist ?? config.blacklist,
    content_filter: drafts.content_filter ?? config.content_filter,
  };
}

export function runBlacklistTest(name: string, blacklist: BlacklistConfig): BlacklistTestResult {
  if (!blacklist.enabled) return { blocked: false };

  const normalizedName = blacklist.case_insensitive ? name.toLowerCase() : name;
  const whitelist = blacklist.whitelist ?? [];

  if (
    whitelist.some((value) => {
      const normalizedValue = blacklist.case_insensitive ? value.toLowerCase() : value;
      return normalizedName === normalizedValue || normalizedName.includes(normalizedValue);
    })
  ) {
    return { blocked: false, matchedBy: "whitelist" };
  }

  for (const keyword of blacklist.keywords) {
    const normalizedKeyword = blacklist.case_insensitive ? keyword.toLowerCase() : keyword;
    const matched = blacklist.fuzzy_match
      ? normalizedName.includes(normalizedKeyword)
      : normalizedName === normalizedKeyword;

    if (matched) {
      return {
        blocked: true,
        reason: blacklist.fuzzy_match ? `关键词: "${keyword}"` : `关键词(精确): "${keyword}"`,
        matchedBy: "keyword",
      };
    }
  }

  if (blacklist.regex_match) {
    for (const pattern of blacklist.regex_patterns) {
      try {
        const flags = blacklist.case_insensitive ? "i" : "";
        if (new RegExp(pattern, flags).test(name)) {
          return { blocked: true, reason: `正则: ${pattern}`, matchedBy: "regex" };
        }
      } catch {
        // ignore invalid regex from imported legacy data
      }
    }
  }

  return { blocked: false };
}

export function runContentFilterPreview(
  text: string,
  config: ContentFilterConfig,
): ContentFilterPreviewResult {
  const lines = text.split(/\r?\n/);
  const compiled = config.ad_patterns
    .map((pattern) => {
      try {
        return { pattern, re: new RegExp(pattern) };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as { pattern: string; re: RegExp }[];

  const previewLines: ContentPreviewLine[] = lines.map((line) => {
    for (const { pattern, re } of compiled) {
      if (re.test(line)) {
        return { text: line, removed: true, matchedRule: pattern };
      }
    }
    return { text: line, removed: false };
  });

  if (config.nav_keywords.length > 0) {
    for (let index = previewLines.length - 1; index >= 0; index -= 1) {
      if (previewLines[index].removed) continue;

      const matchedNav = config.nav_keywords.find((keyword) =>
        previewLines[index].text.includes(keyword),
      );

      if (matchedNav) {
        previewLines[index] = {
          ...previewLines[index],
          removed: true,
          isNavStrip: true,
          matchedRule: matchedNav,
        };
      } else {
        break;
      }
    }
  }

  const removedCount = previewLines.filter((line) => line.removed).length;
  const keptCount = previewLines.length - removedCount;
  const keptRatio = previewLines.length > 0 ? keptCount / previewLines.length : 1;

  if (keptRatio < config.safety_threshold) {
    return {
      lines: previewLines.map((line) => ({
        ...line,
        removed: false,
        matchedRule: undefined,
        isNavStrip: undefined,
      })),
      removedCount: 0,
      keptCount: previewLines.length,
      keptRatio: 1,
      safetyRollback: true,
    };
  }

  return {
    lines: previewLines,
    removedCount,
    keptCount,
    keptRatio,
    safetyRollback: false,
  };
}

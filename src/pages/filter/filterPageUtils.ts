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

export function mergeUniqueStrings(current: string[], incoming: string[]): string[] {
  return [...new Set([...current, ...incoming])];
}

export function serializeFilterDraft(value: unknown): string {
  return JSON.stringify(value);
}

export function buildImportSummary(
  acceptedCount: number,
  duplicateCount: number,
  emptyCount: number,
  noun: string,
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

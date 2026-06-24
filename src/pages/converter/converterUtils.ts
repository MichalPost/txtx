import type { ConvertResult } from "./types";

export interface ConverterSummary {
  total: number;
  success: number;
  failed: number;
}

export interface PathImportSummary {
  accepted: string[];
  duplicateCount: number;
  emptyCount: number;
}

export function countFilledPaths(paths: string[]): number {
  return paths.filter((path) => path.trim().length > 0).length;
}

export function summarizeConvertResults(results: ConvertResult[]): ConverterSummary {
  const success = results.filter((result) => result.ok).length;
  return {
    total: results.length,
    success,
    failed: results.length - success,
  };
}

function normalizeImportedPath(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

export function parsePathImportDraft(draft: string, existingPaths: string[] = []): PathImportSummary {
  const existing = new Set(
    existingPaths.map((path) => normalizeImportedPath(path).toLowerCase()).filter(Boolean),
  );
  const accepted: string[] = [];
  let duplicateCount = 0;
  let emptyCount = 0;

  for (const part of draft.split(/[\n\r;]+/)) {
    const path = normalizeImportedPath(part);
    if (!path) {
      emptyCount += 1;
      continue;
    }

    const key = path.toLowerCase();
    if (existing.has(key)) {
      duplicateCount += 1;
      continue;
    }

    existing.add(key);
    accepted.push(path);
  }

  return { accepted, duplicateCount, emptyCount };
}

export function getRegexValidationError(pattern: string): string | null {
  const trimmed = pattern.trim();
  if (!trimmed) return null;

  try {
    new RegExp(trimmed);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "正则表达式无效";
  }
}

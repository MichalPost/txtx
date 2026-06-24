import type { ConvertResult } from "./types";

export interface ConverterSummary {
  total: number;
  success: number;
  failed: number;
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

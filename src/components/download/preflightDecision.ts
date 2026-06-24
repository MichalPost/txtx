import type { SiteHealth } from "@/types";

export interface PreflightDecisionInput {
  done: boolean;
  error: string;
}

export function canContinueWithPreflight({ done, error }: PreflightDecisionInput): boolean {
  return done && !error;
}

export function buildPreflightScope(selectedSites: string[] | null, enabledSites: string[]): string[] {
  const source = selectedSites && selectedSites.length > 0 ? selectedSites : enabledSites;
  return [...source].map((site) => site.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function summarizePreflightResults(results: SiteHealth[], scopedSites: string[]) {
  const normalizedScope = new Set(scopedSites.map((site) => site.replace(/^https?:\/\//, "").trim()));
  const scopedResults =
    normalizedScope.size === 0
      ? results
      : results.filter((item) =>
          normalizedScope.has(item.domain.replace(/^https?:\/\//, "").trim()),
        );

  const successCount = scopedResults.filter((item) => item.reachable).length;
  const failingDomains = scopedResults
    .filter((item) => !item.reachable)
    .map((item) => item.domain.replace(/^https?:\/\//, "").trim());

  return {
    results: scopedResults,
    total: scopedResults.length,
    successCount,
    failCount: failingDomains.length,
    failingDomains,
  };
}

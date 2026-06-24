import type { WebsiteConfig } from "@/types";

export type RulesFilterStatus = "all" | "enabled" | "disabled" | "complete" | "incomplete";
export type RulesSortMode = "name_asc" | "name_desc" | "enabled_first";

export interface RulesListQuery {
  search: string;
  status: RulesFilterStatus;
  sort: RulesSortMode;
  sitePriority?: Record<string, number>;
}

export interface RulesSummary {
  total: number;
  enabled: number;
  complete: number;
  incomplete: number;
}

export interface VisibleRuleWindow {
  visibleKeys: string[];
  visibleCount: number;
  totalCount: number;
  hasMore: boolean;
  nextVisibleCount: number;
}

function getRuleCompletion(site: WebsiteConfig): boolean {
  const required = [site.domain_name, site.list_novel_name, site.release_url, site.novel_content];
  return required.filter((value) => Boolean(value?.trim())).length === required.length;
}

function getDisplayDomain(site: WebsiteConfig): string {
  return site.domain_name.replace(/^https?:\/\//, "").replace(/\/$/, "") || site.domain_name;
}

function matchesStatus(site: WebsiteConfig, status: RulesFilterStatus): boolean {
  if (status === "all") return true;
  if (status === "enabled") return site.enabled;
  if (status === "disabled") return !site.enabled;
  if (status === "complete") return getRuleCompletion(site);
  if (status === "incomplete") return !getRuleCompletion(site);
  return true;
}

export function filterAndSortRules(
  websites: Record<string, WebsiteConfig>,
  query: RulesListQuery,
): string[] {
  const normalizedSearch = query.search.trim().toLowerCase();

  const filtered = Object.entries(websites).filter(([key, site]) => {
    const domain = getDisplayDomain(site).toLowerCase();
    const matchesKeyword =
      normalizedSearch.length === 0 ||
      key.toLowerCase().includes(normalizedSearch) ||
      domain.includes(normalizedSearch);

    return matchesKeyword && matchesStatus(site, query.status);
  });

  filtered.sort(([keyA, siteA], [keyB, siteB]) => {
    if (query.sort === "enabled_first") {
      if (siteA.enabled !== siteB.enabled) return siteA.enabled ? -1 : 1;
      const priorityA = query.sitePriority?.[siteA.domain_name] ?? Number.MAX_SAFE_INTEGER;
      const priorityB = query.sitePriority?.[siteB.domain_name] ?? Number.MAX_SAFE_INTEGER;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return getDisplayDomain(siteA).localeCompare(getDisplayDomain(siteB), "zh-CN");
    }

    const compareResult = getDisplayDomain(siteA).localeCompare(getDisplayDomain(siteB), "zh-CN");
    if (compareResult !== 0) {
      return query.sort === "name_desc" ? -compareResult : compareResult;
    }
    return keyA.localeCompare(keyB, "zh-CN");
  });

  return filtered.map(([key]) => key);
}

export function buildRulesSummary(websites: Record<string, WebsiteConfig>): RulesSummary {
  return Object.values(websites).reduce<RulesSummary>(
    (summary, site) => {
      summary.total += 1;
      if (site.enabled) summary.enabled += 1;
      if (getRuleCompletion(site)) {
        summary.complete += 1;
      } else {
        summary.incomplete += 1;
      }
      return summary;
    },
    { total: 0, enabled: 0, complete: 0, incomplete: 0 },
  );
}

export function buildVisibleRuleWindow(
  siteKeys: string[],
  visibleCount: number,
  batchSize: number,
): VisibleRuleWindow {
  const normalizedBatch = Math.max(1, Math.floor(batchSize));
  const normalizedVisibleCount = Math.min(
    siteKeys.length,
    Math.max(normalizedBatch, Math.floor(visibleCount)),
  );
  const nextVisibleCount = Math.min(siteKeys.length, normalizedVisibleCount + normalizedBatch);

  return {
    visibleKeys: siteKeys.slice(0, normalizedVisibleCount),
    visibleCount: normalizedVisibleCount,
    totalCount: siteKeys.length,
    hasMore: normalizedVisibleCount < siteKeys.length,
    nextVisibleCount,
  };
}

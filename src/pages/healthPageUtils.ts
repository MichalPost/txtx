import type { SiteHealth } from "@/types";

export type HealthStatusFilter = "all" | "reachable" | "unreachable";
export type HealthSortOption = "latency-asc" | "latency-desc" | "domain-asc" | "domain-desc" | "status";
export type HealthViewState = "idle" | "checking" | "empty" | "no-match" | "results";

export interface HealthFilterQuery {
  query: string;
  status: HealthStatusFilter;
  sort: HealthSortOption;
}

export interface HealthSummary {
  total: number;
  reachable: number;
  unreachable: number;
  averageLatency: number | null;
  fastestSite: string | null;
  fastestLatency: number | null;
}

export interface HealthViewStateInput {
  hasChecked: boolean;
  checking: boolean;
  totalResults: number;
  visibleResults: number;
}

export interface HealthReportInput {
  results: SiteHealth[];
  checkedAt: Date | null;
}

function normalizeDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, "").trim();
}

function compareLatency(a: SiteHealth, b: SiteHealth): number {
  const aLatency = a.latency_ms ?? Number.POSITIVE_INFINITY;
  const bLatency = b.latency_ms ?? Number.POSITIVE_INFINITY;
  return aLatency - bLatency;
}

function compareDomain(a: SiteHealth, b: SiteHealth): number {
  return normalizeDomain(a.domain).localeCompare(normalizeDomain(b.domain), "zh-CN");
}

export function buildHealthSummary(results: SiteHealth[]): HealthSummary {
  const reachableResults = results.filter((item) => item.reachable);
  const latencyValues = reachableResults
    .map((item) => item.latency_ms)
    .filter((latency): latency is number => latency != null);
  const fastest = [...reachableResults]
    .filter((item) => item.latency_ms != null)
    .sort(compareLatency)[0];

  return {
    total: results.length,
    reachable: reachableResults.length,
    unreachable: results.length - reachableResults.length,
    averageLatency:
      latencyValues.length > 0
        ? Math.round(latencyValues.reduce((sum, latency) => sum + latency, 0) / latencyValues.length)
        : null,
    fastestSite: fastest ? normalizeDomain(fastest.domain) : null,
    fastestLatency: fastest?.latency_ms ?? null,
  };
}

export function filterAndSortSiteHealth(
  results: SiteHealth[],
  query: HealthFilterQuery,
): SiteHealth[] {
  const normalizedQuery = query.query.trim().toLowerCase();

  const filtered = results.filter((item) => {
    const normalizedDomain = normalizeDomain(item.domain).toLowerCase();
    const matchesQuery =
      normalizedQuery.length === 0 ||
      normalizedDomain.includes(normalizedQuery) ||
      (item.error ?? "").toLowerCase().includes(normalizedQuery);
    const matchesStatus =
      query.status === "all" ||
      (query.status === "reachable" ? item.reachable : !item.reachable);

    return matchesQuery && matchesStatus;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (query.sort) {
      case "latency-asc":
        return compareLatency(a, b) || compareDomain(a, b);
      case "latency-desc":
        return compareLatency(b, a) || compareDomain(a, b);
      case "domain-desc":
        return compareDomain(b, a);
      case "status":
        if (a.reachable !== b.reachable) return a.reachable ? 1 : -1;
        return compareLatency(a, b) || compareDomain(a, b);
      case "domain-asc":
      default:
        return compareDomain(a, b);
    }
  });

  return sorted;
}

export function deriveHealthViewState(input: HealthViewStateInput): HealthViewState {
  if (input.checking && input.totalResults === 0) return "checking";
  if (!input.hasChecked) return "idle";
  if (input.totalResults === 0) return "empty";
  if (input.visibleResults === 0) return "no-match";
  return "results";
}

export function formatHealthDomain(domain: string): string {
  return normalizeDomain(domain);
}

export function buildHealthReport({ results, checkedAt }: HealthReportInput): string {
  const summary = buildHealthSummary(results);
  const lines = [
    "站点健康检查报告",
    `检查时间：${checkedAt ? checkedAt.toLocaleString("zh-CN") : "未记录"}`,
    "",
    `站点总数：${summary.total}`,
    `可达站点：${summary.reachable}`,
    `不可达站点：${summary.unreachable}`,
    `平均延迟：${summary.averageLatency == null ? "暂无" : `${summary.averageLatency} ms`}`,
    summary.fastestSite
      ? `最快站点：${summary.fastestSite} (${summary.fastestLatency ?? "暂无"} ms)`
      : "最快站点：暂无",
    "",
    "明细：",
  ];

  for (const item of filterAndSortSiteHealth(results, { query: "", status: "all", sort: "status" })) {
    const latency = item.latency_ms == null ? "暂无" : `${item.latency_ms} ms`;
    const status = item.reachable ? "可达" : "不可达";
    const error = item.error ? `；错误：${item.error}` : "";
    lines.push(`- ${formatHealthDomain(item.domain)}：${status}；延迟：${latency}${error}`);
  }

  return lines.join("\n");
}

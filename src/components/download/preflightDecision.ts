import type { SiteHealth } from "@/types";

export interface PreflightDecisionInput {
  done: boolean;
  error: string;
}

export interface PreflightSummary {
  results: SiteHealth[];
  total: number;
  successCount: number;
  failCount: number;
  failingDomains: string[];
}

export interface PreflightDecision {
  canContinue: boolean;
  ctaLabel: string;
  description: string;
  retryLabel: string;
  title: string;
  tone: "success" | "warning" | "danger" | "neutral";
}

export function canContinueWithPreflight({ done, error }: PreflightDecisionInput): boolean {
  return done && !error;
}

export function buildPreflightScope(selectedSites: string[] | null, enabledSites: string[]): string[] {
  const source = selectedSites && selectedSites.length > 0 ? selectedSites : enabledSites;
  return [...source].map((site) => site.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function summarizePreflightResults(
  results: SiteHealth[],
  scopedSites: string[],
): PreflightSummary {
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

export function buildPreflightDecision(args: {
  done: boolean;
  error: string;
  scopedSites: string[];
  summary: PreflightSummary;
}): PreflightDecision {
  if (!args.done) {
    return {
      canContinue: false,
      ctaLabel: "先检测站点",
      description: `将检测 ${args.scopedSites.length} 个目标站点的可达性，避免直接创建大批失败任务。`,
      retryLabel: "开始检测",
      title: "等待预检",
      tone: "neutral",
    };
  }

  if (args.error) {
    return {
      canContinue: false,
      ctaLabel: "检测失败",
      description: "预检请求没有完成，请重新检测；如果连续失败，再检查后端服务或网络代理。",
      retryLabel: "重新检测",
      title: "预检未完成",
      tone: "danger",
    };
  }

  if (args.summary.failCount > 0) {
    const sample = args.summary.failingDomains.slice(0, 3).join("、");
    const suffix =
      args.summary.failingDomains.length > 3
        ? ` 等 ${args.summary.failingDomains.length} 个站点`
        : sample;

    return {
      canContinue: true,
      ctaLabel: "忽略异常并创建",
      description: `${args.summary.failCount} / ${args.summary.total} 个目标站点不可达：${suffix}。继续创建可能产生失败任务。`,
      retryLabel: "重新检测",
      title: "部分站点异常",
      tone: "warning",
    };
  }

  return {
    canContinue: true,
    ctaLabel: "创建扫描任务",
    description: `本次要扫描的 ${args.summary.successCount} 个站点都可达，可以创建扫描任务。`,
    retryLabel: "重新检测",
    title: "预检通过",
    tone: "success",
  };
}

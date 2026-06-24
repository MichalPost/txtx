import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpDown,
  CheckCircle,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { apiCheckSites } from "@/lib/api";
import { formatToolActionError } from "@/lib/toolActionError";

import {
  buildHealthSummary,
  deriveHealthViewState,
  filterAndSortSiteHealth,
  formatHealthDomain,
  type HealthSortOption,
  type HealthStatusFilter,
} from "./healthPageUtils";

function formatCheckedTime(value: Date | null): string | null {
  if (!value) return null;
  return value.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatLatency(value: number | null): string {
  return value == null ? "暂无" : `${value} ms`;
}

const STATUS_OPTIONS: { value: HealthStatusFilter; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "reachable", label: "仅可达" },
  { value: "unreachable", label: "仅不可达" },
];

const SORT_OPTIONS: { value: HealthSortOption; label: string }[] = [
  { value: "status", label: "按状态（异常优先）" },
  { value: "latency-asc", label: "按延迟（从快到慢）" },
  { value: "latency-desc", label: "按延迟（从慢到快）" },
  { value: "domain-asc", label: "按域名（A-Z）" },
  { value: "domain-desc", label: "按域名（Z-A）" },
];

export function HealthPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<HealthStatusFilter>("all");
  const [sort, setSort] = useState<HealthSortOption>("status");
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const {
    mutate: checkSites,
    data: results = [],
    error,
    isError,
    isIdle,
    isPending: checking,
    isSuccess,
  } = useMutation({
    mutationFn: apiCheckSites,
    onSuccess: () => setLastCheckedAt(new Date()),
    onError: (mutationError) =>
      toast.error(formatToolActionError("检查站点健康", mutationError)),
  });

  const summary = useMemo(() => buildHealthSummary(results), [results]);
  const filteredResults = useMemo(
    () =>
      filterAndSortSiteHealth(results, {
        query: search,
        status: statusFilter,
        sort,
      }),
    [results, search, sort, statusFilter],
  );
  const viewState = useMemo(
    () =>
      deriveHealthViewState({
        hasChecked: isSuccess || isError,
        checking,
        totalResults: results.length,
        visibleResults: filteredResults.length,
      }),
    [checking, filteredResults.length, isError, isSuccess, results.length],
  );

  const hasFilters = search.trim().length > 0 || statusFilter !== "all";
  const checkedTime = formatCheckedTime(lastCheckedAt);

  const runCheck = () => {
    checkSites(undefined);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSort("status");
  };

  const subtitle = (() => {
    if (checking && !isSuccess) return "正在检查各站点的连通性和响应延迟";
    if (summary.total > 0) {
      const base = `${summary.reachable}/${summary.total} 个站点可达`;
      if (checkedTime) return `${base} · 最近检查 ${checkedTime}`;
      return base;
    }
    if (isError) return "检查失败，请重试或调整筛选后再次查看";
    return "检查各站点的连通性和响应延迟";
  })();

  const statCards = [
    {
      label: "站点总数",
      value: summary.total,
      tone: "var(--color-accent)",
      bg: "var(--color-accent-muted)",
      border: "color-mix(in srgb, var(--color-accent) 24%, transparent)",
    },
    {
      label: "可达",
      value: summary.reachable,
      tone: "var(--color-success)",
      bg: "var(--color-success-bg)",
      border: "color-mix(in srgb, var(--color-success) 24%, transparent)",
    },
    {
      label: "不可达",
      value: summary.unreachable,
      tone: "var(--color-danger)",
      bg: "var(--color-danger-bg)",
      border: "color-mix(in srgb, var(--color-danger) 24%, transparent)",
    },
    {
      label: summary.fastestSite ? `最快站点 · ${summary.fastestSite}` : "平均延迟",
      value: summary.fastestSite
        ? formatLatency(summary.fastestLatency)
        : formatLatency(summary.averageLatency),
      tone: "var(--color-warning)",
      bg: "var(--color-warning-bg)",
      border: "color-mix(in srgb, var(--color-warning) 24%, transparent)",
    },
  ];

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-5">
      <PageHeader
        title="站点健康检查"
        subtitle={subtitle}
        actions={
          <>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                清空筛选
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={runCheck} disabled={checking}>
              {checking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isIdle ? (
                <Activity className="h-3.5 w-3.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {checking ? "检查中..." : isIdle ? "开始检查" : "再次检查"}
            </Button>
          </>
        }
      />

      <div className="grid shrink-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border px-4 py-3"
            style={{
              background: card.bg,
              borderColor: card.border,
            }}
          >
            <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold" style={{ color: card.tone }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div
        className="shrink-0 rounded-2xl border p-3"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
              />
              <input
                className="w-full rounded-lg border py-2 pr-9 pl-8 text-xs focus:outline-none"
                style={{
                  background: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
                placeholder="搜索域名或错误信息..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute top-1/2 right-2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full transition-opacity hover:opacity-70"
                  style={{ color: "var(--color-text-muted)" }}
                  title="清空搜索"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex min-w-0 gap-2 sm:w-auto sm:min-w-52">
              <div className="relative min-w-0 flex-1">
                <SlidersHorizontal
                  className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: "var(--color-text-muted)" }}
                />
                <select
                  className="w-full appearance-none rounded-lg border py-2 pr-8 pl-8 text-xs focus:outline-none"
                  style={{
                    background: "var(--color-surface-2)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as HealthStatusFilter)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative min-w-0 flex-1">
                <ArrowUpDown
                  className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: "var(--color-text-muted)" }}
                />
                <select
                  className="w-full appearance-none rounded-lg border py-2 pr-8 pl-8 text-xs focus:outline-none"
                  style={{
                    background: "var(--color-surface-2)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                  value={sort}
                  onChange={(event) => setSort(event.target.value as HealthSortOption)}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className="rounded-full px-2.5 py-1"
              style={{
                color: "var(--color-text-muted)",
                background: "var(--color-surface-2)",
              }}
            >
              当前显示 {filteredResults.length} 条
            </span>
            <span
              className="rounded-full px-2.5 py-1"
              style={{
                color: "var(--color-text-muted)",
                background: "var(--color-surface-2)",
              }}
            >
              平均延迟 {formatLatency(summary.averageLatency)}
            </span>
          </div>
        </div>
      </div>

      {isError && (
        <div
          className="flex shrink-0 flex-col gap-3 rounded-2xl border px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: "var(--color-danger-bg)",
            color: "var(--color-danger)",
            borderColor: "color-mix(in srgb, var(--color-danger) 28%, transparent)",
          }}
        >
          <div>
            <p className="font-medium">本次检查失败</p>
            <p className="mt-1 text-xs opacity-90">{formatToolActionError("检查站点健康", error)}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={runCheck} disabled={checking}>
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
            重试检查
          </Button>
        </div>
      )}

      <Card
        className="flex-1 overflow-hidden"
        bodyClassName="flex h-full flex-col gap-3 overflow-hidden"
        title="检查结果"
        actions={
          summary.total > 0 ? (
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              可达 {summary.reachable} · 不可达 {summary.unreachable}
            </span>
          ) : null
        }
      >
        {viewState === "idle" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "var(--color-accent-muted)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
                boxShadow: "var(--shadow-accent)",
              }}
            >
              <Activity className="h-8 w-8" style={{ color: "var(--color-accent)" }} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
                还没有检查过
              </p>
              <p className="mt-1.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
                点击「开始检查」后，这里会显示健康摘要和逐站点结果。
              </p>
            </div>
          </div>
        )}

        {viewState === "checking" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "var(--color-accent-muted)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
              }}
            >
              <Loader2
                className="h-8 w-8 animate-spin"
                style={{ color: "var(--color-accent)" }}
              />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
                正在检查站点
              </p>
              <p className="mt-1.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
                我们正在测试全部站点的可达性和响应延迟，请稍候。
              </p>
            </div>
          </div>
        )}

        {viewState === "empty" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
              }}
            >
              <Clock3 className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
                没有可展示的检查结果
              </p>
              <p className="mt-1.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
                检查已完成，但当前没有返回任何站点结果，可能是没有启用站点。
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={runCheck} disabled={checking}>
              <RefreshCw className="h-3.5 w-3.5" />
              再检查一次
            </Button>
          </div>
        )}

        {viewState === "no-match" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
              }}
            >
              <Search className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
                没有匹配的结果
              </p>
              <p className="mt-1.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
                试试修改关键词、状态筛选，或清空筛选条件后再看。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                清空筛选
              </Button>
              <Button variant="secondary" size="sm" onClick={runCheck} disabled={checking}>
                <RefreshCw className="h-3.5 w-3.5" />
                再次检查
              </Button>
            </div>
          </div>
        )}

        {viewState === "results" && (
          <>
            <div
              className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              <span>
                显示 {filteredResults.length} / {summary.total} 个站点
              </span>
              <span>{checking ? "正在刷新结果..." : "结果已完成"}</span>
            </div>

            <div className="flex-1 overflow-auto">
              <div className="flex flex-col gap-3">
                {filteredResults.map((item) => (
                  <div
                    key={item.domain}
                    className="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center"
                    style={{
                      background: "var(--color-surface-2)",
                      borderColor: item.reachable
                        ? "color-mix(in srgb, var(--color-success) 32%, var(--color-border))"
                        : "color-mix(in srgb, var(--color-danger) 35%, var(--color-border))",
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: item.reachable
                            ? "var(--color-success-bg)"
                            : "var(--color-danger-bg)",
                        }}
                      >
                        {item.reachable ? (
                          <CheckCircle
                            className="h-4.5 w-4.5 shrink-0"
                            style={{ color: "var(--color-success)" }}
                          />
                        ) : (
                          <XCircle
                            className="h-4.5 w-4.5 shrink-0"
                            style={{ color: "var(--color-danger)" }}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-medium"
                          style={{ color: "var(--color-text)" }}
                          title={formatHealthDomain(item.domain)}
                        >
                          {formatHealthDomain(item.domain)}
                        </p>
                        <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                          {item.reachable ? "站点可达" : "站点不可达"}
                          {item.error ? ` · ${item.error}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
                      <span
                        className="rounded-full px-2.5 py-1 text-xs"
                        style={{
                          background: item.reachable
                            ? "var(--color-success-bg)"
                            : "var(--color-danger-bg)",
                          color: item.reachable ? "var(--color-success)" : "var(--color-danger)",
                        }}
                      >
                        {item.reachable ? "可达" : "不可达"}
                      </span>
                      <span
                        className="rounded-full px-2.5 py-1 text-xs"
                        style={{
                          background:
                            item.reachable && (item.latency_ms ?? Number.POSITIVE_INFINITY) < 500
                              ? "var(--color-success-bg)"
                              : "var(--color-warning-bg)",
                          color:
                            item.reachable && (item.latency_ms ?? Number.POSITIVE_INFINITY) < 500
                              ? "var(--color-success)"
                              : "var(--color-warning)",
                        }}
                      >
                        {formatLatency(item.latency_ms)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

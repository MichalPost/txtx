import { lazy, Suspense, useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, FileDown, Filter, Plus, RefreshCw, Search, Upload } from "lucide-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import { useConfigStore } from "@/store/configStore";

import { EmptyState } from "./components/EmptyState";
import { SiteList } from "./components/SiteList";
import { DEFAULT_SITE } from "./rulesPageUtils";
import {
  buildRulesSummary,
  filterAndSortRules,
  type RulesFilterStatus,
} from "./rulesListUtils";
import { useRulesPageActions } from "./useRulesPageActions";

const RuleWizard = lazy(() =>
  import("@/components/rule-wizard/RuleWizard").then((module) => ({
    default: module.RuleWizard,
  })),
);

export function RulesPage() {
  const { error: configError, loading: configLoading, loadConfig } = useConfigStore();
  const {
    config,
    saving,
    editingKey,
    setEditingKey,
    recentlySavedKey,
    handleNewSite,
    handleWizardApply,
    handleWizardClose,
    toggleEnabled,
    deleteSite,
    getRuleStatus,
    quickSave,
    duplicateSite,
    reorderSites,
    exportSites,
    importSites,
  } = useRulesPageActions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RulesFilterStatus>("all");
  const websites = useMemo(() => config?.websites ?? {}, [config?.websites]);
  const summary = useMemo(() => buildRulesSummary(websites), [websites]);
  const siteKeys = useMemo(
    () =>
      filterAndSortRules(websites, {
        search,
        status: statusFilter,
        sort: "enabled_first",
        sitePriority: config?.filtering.site_priority,
      }),
    [config?.filtering.site_priority, search, statusFilter, websites],
  );
  const hasActiveFilters = search.trim().length > 0 || statusFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  if (configError) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="shrink-0 px-5 pt-5">
          <PageHeader
            title="规则管理"
            subtitle="管理站点抓取规则，支持快速筛选、导入导出和拖拽排序"
          />
        </div>
        <div className="flex flex-1 items-center px-5 py-5">
          <div
            className="flex w-full flex-col items-center justify-center gap-5 rounded-2xl border px-6 py-12 text-center"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "var(--color-danger-bg)",
                border: "1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)",
              }}
            >
              <AlertCircle className="h-8 w-8" style={{ color: "var(--color-danger)" }} />
            </div>
            <div className="flex max-w-md flex-col gap-2">
              <p className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
                规则配置加载失败
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                当前无法读取站点规则列表，因此编辑、导入、导出和拖拽排序都不可用。请先重试加载配置。
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--color-danger)" }}>
                {configError}
              </p>
            </div>
            <Button size="md" onClick={() => void loadConfig({ force: true })} disabled={configLoading}>
              <RefreshCw className={`h-4 w-4${configLoading ? " animate-spin" : ""}`} />
              {configLoading ? "重试中..." : "重新加载配置"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-5 text-sm" style={{ color: "var(--color-text-muted)" }}>
        {configLoading ? "正在加载..." : "正在准备规则配置..."}
      </div>
    );
  }

  const filterOptions: Array<{ value: RulesFilterStatus; label: string }> = [
    { value: "all", label: "全部" },
    { value: "enabled", label: "已启用" },
    { value: "disabled", label: "已停用" },
    { value: "complete", label: "已完整" },
    { value: "incomplete", label: "待完善" },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5">
        <PageHeader
          title={editingKey ? (websites[editingKey] ? "编辑规则" : "新建规则") : "规则管理"}
          subtitle={
            editingKey
              ? "通过向导配置目录页、章节页和抓取字段"
              : "管理站点抓取规则，支持快速筛选、导入导出和拖拽排序"
          }
          actions={
            editingKey ? (
              <Button variant="secondary" size="sm" onClick={handleWizardClose}>
                <ChevronLeft className="h-3.5 w-3.5" />
                返回列表
              </Button>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={importSites}>
                  <Upload className="h-3.5 w-3.5" />
                  导入
                </Button>
                <Button variant="secondary" size="sm" onClick={exportSites}>
                  <FileDown className="h-3.5 w-3.5" />
                  导出
                </Button>
                <Button size="sm" onClick={handleNewSite} disabled={saving}>
                  <Plus className="h-3.5 w-3.5" />
                  新建规则
                </Button>
              </>
            )
          }
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
        {!editingKey && summary.total > 0 && (
          <div
            className="rounded-2xl border p-3"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
                    style={{ color: "var(--color-text-subtle)" }}
                  />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索站点域名或规则 key..."
                    className="h-9 pl-8 text-xs"
                    aria-label="搜索规则"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStatusFilter(option.value)}
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                      style={{
                        background:
                          statusFilter === option.value
                            ? "color-mix(in srgb, var(--color-accent) 14%, transparent)"
                            : "var(--color-surface-2)",
                        color:
                          statusFilter === option.value
                            ? "var(--color-accent)"
                            : "var(--color-text-muted)",
                        border: `1px solid ${
                          statusFilter === option.value
                            ? "color-mix(in srgb, var(--color-accent) 28%, transparent)"
                            : "var(--color-border)"
                        }`,
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className="rounded-full px-2.5 py-1"
                  style={{
                    background: "var(--color-surface-2)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  共 {summary.total} 条
                </span>
                <span
                  className="rounded-full px-2.5 py-1"
                  style={{
                    background: "var(--color-surface-2)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  启用 {summary.enabled}
                </span>
                <span
                  className="rounded-full px-2.5 py-1"
                  style={{
                    background: "var(--color-surface-2)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  待完善 {summary.incomplete}
                </span>
              </div>
            </div>
          </div>
        )}

        {summary.total === 0 && editingKey === null && <EmptyState onNew={handleNewSite} />}

        {editingKey && (
          <Suspense
            fallback={
              <div
                className="rounded-2xl border px-4 py-6 text-sm"
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
                正在加载规则向导...
              </div>
            }
          >
            <RuleWizard
              site={websites[editingKey] ?? DEFAULT_SITE}
              onApply={(patch) => handleWizardApply(editingKey, patch)}
              onClose={handleWizardClose}
            />
          </Suspense>
        )}

        {summary.total > 0 && !editingKey && (
          <>
            {siteKeys.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border px-4 py-10 text-center"
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{
                    background: "var(--color-accent-muted)",
                    border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
                  }}
                >
                  <Filter className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                    没有符合条件的规则
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {hasActiveFilters
                      ? "换个关键词、切换筛选条件，或一键清空筛选后再试。"
                      : "当前列表为空，请新建一条规则，或导入现有站点配置。"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {hasActiveFilters ? (
                    <Button variant="secondary" size="sm" onClick={clearFilters}>
                      清空筛选
                    </Button>
                  ) : null}
                  <Button variant="secondary" size="sm" onClick={importSites}>
                    <Upload className="h-3.5 w-3.5" />
                    导入规则
                  </Button>
                  <Button size="sm" onClick={handleNewSite} disabled={saving}>
                    <Plus className="h-3.5 w-3.5" />
                    新建规则
                  </Button>
                </div>
              </div>
            ) : (
              <SiteList
                siteKeys={siteKeys}
                websites={websites}
                getRuleStatus={getRuleStatus}
                recentlySavedKey={recentlySavedKey}
                onEdit={(key) => setEditingKey(key)}
                onToggle={toggleEnabled}
                onDelete={deleteSite}
                onQuickSave={quickSave}
                onReorder={reorderSites}
                onDuplicate={duplicateSite}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

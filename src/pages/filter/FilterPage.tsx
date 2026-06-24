import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Shield, Sparkles, TriangleAlert } from "lucide-react";

import { Card } from "@/components/Card";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { useConfigStore } from "@/store/configStore";
import type { AppConfig, BlacklistConfig, ContentFilterConfig } from "@/types";

import { BlacklistTab } from "./BlacklistTab";
import { ContentCleanTab } from "./ContentCleanTab";
import {
  buildFilterSaveState,
  formatSavedAt,
  mergeFilterConfigDrafts,
  serializeFilterDraft,
} from "./filterPageUtils";

type TabId = "blacklist" | "content";

const TABS: { id: TabId; label: string; icon: React.ElementType; desc: string }[] = [
  {
    id: "blacklist",
    label: "黑名单",
    icon: Shield,
    desc: "过滤不下载的书名、作者、关键词",
  },
  {
    id: "content",
    label: "内容清洗",
    icon: Sparkles,
    desc: "删除广告行、剥离章节导航文字",
  },
];

export function FilterPage() {
  const [activeTab, setActiveTab] = useState<TabId>("blacklist");
  const { config, saveConfig, saving } = useConfigStore();
  const [blacklistSavedSnapshot, setBlacklistSavedSnapshot] = useState<string | null>(null);
  const [contentSavedSnapshot, setContentSavedSnapshot] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [blacklistDraft, setBlacklistDraft] = useState<BlacklistConfig | null>(null);
  const [contentDraft, setContentDraft] = useState<ContentFilterConfig | null>(null);
  const [tabSwitchPending, setTabSwitchPending] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const blacklist = config?.blacklist;
  const contentFilter = config?.content_filter;

  const blacklistSnapshot = useMemo(
    () => (blacklist ? serializeFilterDraft(blacklist) : null),
    [blacklist],
  );
  const contentSnapshot = useMemo(
    () => (contentFilter ? serializeFilterDraft(contentFilter) : null),
    [contentFilter],
  );
  const blacklistDraftSnapshot = useMemo(
    () => (blacklistDraft ? serializeFilterDraft(blacklistDraft) : null),
    [blacklistDraft],
  );
  const contentDraftSnapshot = useMemo(
    () => (contentDraft ? serializeFilterDraft(contentDraft) : null),
    [contentDraft],
  );

  useEffect(() => {
    if (blacklistSnapshot && blacklistSavedSnapshot === null) {
      setBlacklistSavedSnapshot(blacklistSnapshot);
    }
  }, [blacklistSnapshot, blacklistSavedSnapshot]);

  useEffect(() => {
    if (contentSnapshot && contentSavedSnapshot === null) {
      setContentSavedSnapshot(contentSnapshot);
    }
  }, [contentSnapshot, contentSavedSnapshot]);

  useEffect(() => {
    if (!blacklist) return;
    if (!blacklistDraft || blacklistDraftSnapshot === blacklistSavedSnapshot) {
      setBlacklistDraft(blacklist);
    }
  }, [blacklist, blacklistDraft, blacklistDraftSnapshot, blacklistSavedSnapshot]);

  useEffect(() => {
    if (!contentFilter) return;
    if (!contentDraft || contentDraftSnapshot === contentSavedSnapshot) {
      setContentDraft(contentFilter);
    }
  }, [contentDraft, contentDraftSnapshot, contentFilter, contentSavedSnapshot]);

  const currentSnapshot =
    activeTab === "blacklist" ? blacklistDraftSnapshot : contentDraftSnapshot;
  const savedSnapshot = activeTab === "blacklist" ? blacklistSavedSnapshot : contentSavedSnapshot;
  const saveState = currentSnapshot
    ? buildFilterSaveState({
        savedSnapshot,
        currentSnapshot,
        saving,
        lastSavedAt,
      })
    : null;

  const tabMetrics = {
    blacklist: {
      primary: `${blacklistDraft?.keywords.length ?? 0} 个关键词`,
      secondary: `${blacklistDraft?.regex_patterns.length ?? 0} 条正则`,
      helper: `${blacklistDraft?.whitelist?.length ?? 0} 个白名单豁免`,
    },
    content: {
      primary: `${contentDraft?.ad_patterns.length ?? 0} 条广告规则`,
      secondary: `${contentDraft?.nav_keywords.length ?? 0} 个导航词`,
      helper: `安全阈值 ${Math.round((contentDraft?.safety_threshold ?? 0) * 100)}%`,
    },
  } as const;

  useEffect(() => {
    const hasUnsavedChanges =
      (blacklistDraftSnapshot && blacklistDraftSnapshot !== blacklistSavedSnapshot) ||
      (contentDraftSnapshot && contentDraftSnapshot !== contentSavedSnapshot);
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [
    blacklistDraftSnapshot,
    blacklistSavedSnapshot,
    contentDraftSnapshot,
    contentSavedSnapshot,
  ]);

  if (!config || !blacklistDraft || !contentDraft) {
    return (
      <div className="p-5 text-sm" style={{ color: "var(--color-text-muted)" }}>
        正在加载过滤配置...
      </div>
    );
  }

  const activeMetrics = tabMetrics[activeTab];

  const switchTab = async (nextTab: TabId) => {
    if (nextTab === activeTab) return;
    if (tabSwitchPending) return;
    if (saveState?.dirty) {
      setTabSwitchPending(true);
      const shouldSwitch = await confirm({
        title: "切换过滤标签？",
        description: "当前筛选页有未保存修改。切换后草稿会保留，但请记得回到本页保存。",
        confirmLabel: "切换标签",
        tone: "warning",
      }).catch(() => false);
      setTabSwitchPending(false);
      if (!shouldSwitch) return;
    }
    setActiveTab(nextTab);
  };

  const buildMergedConfig = (overrides: Partial<Pick<AppConfig, "blacklist" | "content_filter">>) =>
    mergeFilterConfigDrafts(config, {
      blacklist: overrides.blacklist ?? blacklistDraft,
      content_filter: overrides.content_filter ?? contentDraft,
    });

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-5">
      <PageHeader
        title="过滤中心"
        subtitle="统一管理黑名单和内容清洗规则，先在这里调稳过滤质量，再投入批量下载。"
      />

      <Card inset className="shrink-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  background:
                    activeTab === "blacklist"
                      ? "color-mix(in srgb, var(--color-accent) 14%, transparent)"
                      : "color-mix(in srgb, var(--color-success, #22c55e) 14%, transparent)",
                  color:
                    activeTab === "blacklist"
                      ? "var(--color-accent)"
                      : "var(--color-success, #22c55e)",
                }}
              >
                {activeTab === "blacklist" ? "黑名单规则集" : "内容清洗规则集"}
              </span>
              {saveState && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                  style={{
                    background:
                      saveState.tone === "warning"
                        ? "color-mix(in srgb, var(--color-warning, #f59e0b) 14%, transparent)"
                        : saveState.tone === "success"
                          ? "color-mix(in srgb, var(--color-success, #22c55e) 14%, transparent)"
                          : "var(--color-surface-2)",
                    color:
                      saveState.tone === "warning"
                        ? "var(--color-warning, #f59e0b)"
                        : saveState.tone === "success"
                          ? "var(--color-success, #22c55e)"
                          : "var(--color-text-muted)",
                  }}
                >
                  {saveState.tone === "warning" ? (
                    <TriangleAlert className="h-3.5 w-3.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  {saveState.label}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span style={{ color: "var(--color-text)" }}>{activeMetrics.primary}</span>
              <span style={{ color: "var(--color-text)" }}>{activeMetrics.secondary}</span>
              <span style={{ color: "var(--color-text-muted)" }}>{activeMetrics.helper}</span>
            </div>
          </div>

          <div
            className="rounded-2xl border px-4 py-3 text-sm lg:max-w-sm"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-text-muted)",
            }}
          >
            {saveState?.hint ?? "配置加载后可查看摘要、测试规则并保存过滤策略。"}
          </div>
        </div>
      </Card>

      <div className="grid shrink-0 gap-3 md:grid-cols-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const metrics = tabMetrics[tab.id];

          return (
            <button
              key={tab.id}
              onClick={() => void switchTab(tab.id)}
              disabled={tabSwitchPending}
              className="rounded-[18px] border p-4 text-left transition-all"
              style={{
                background: isActive ? "var(--color-surface)" : "var(--color-surface-2)",
                borderColor: isActive ? "var(--color-accent)" : "var(--color-border)",
                boxShadow: isActive ? "var(--shadow-md)" : "none",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-2xl"
                    style={{
                      background: isActive
                        ? "var(--color-accent-muted)"
                        : "color-mix(in srgb, var(--color-surface) 75%, transparent)",
                      color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                      {tab.label}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                      {tab.desc}
                    </p>
                  </div>
                </div>
                {isActive && (
                  <span
                    className="rounded-full px-2 py-1 text-[11px] font-medium"
                    style={{ background: "var(--color-accent)", color: "#fff" }}
                  >
                    当前
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {[metrics.primary, metrics.secondary, metrics.helper].map((item) => (
                  <span
                    key={item}
                    className="rounded-full px-2.5 py-1"
                    style={{
                      background: "var(--color-surface)",
                      color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1">
        {activeTab === "blacklist" && (
          <BlacklistTab
            blacklist={blacklistDraft}
            saving={saving}
            onChange={setBlacklistDraft}
            onSave={async (nextBlacklist) => {
              await saveConfig(buildMergedConfig({ blacklist: nextBlacklist }));
            }}
            onSaved={(snapshot) => {
              setBlacklistSavedSnapshot(snapshot);
              setLastSavedAt(formatSavedAt(new Date()));
            }}
          />
        )}
        {activeTab === "content" && (
          <ContentCleanTab
            config={contentDraft}
            saving={saving}
            onChange={setContentDraft}
            onSave={async (nextContentFilter) => {
              await saveConfig(buildMergedConfig({ content_filter: nextContentFilter }));
            }}
            onSaved={(snapshot) => {
              setContentSavedSnapshot(snapshot);
              setLastSavedAt(formatSavedAt(new Date()));
            }}
          />
        )}
      </div>
      {confirmDialog}
    </div>
  );
}

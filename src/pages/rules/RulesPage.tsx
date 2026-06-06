/**
 * RulesPage — 规则管理页面
 *
 * 两种操作入口：
 * - 向导模式：引导普通用户一步步配置规则
 * - 列表模式：快速浏览和编辑已有站点规则
 */
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { RuleWizard } from "@/components/rule-wizard/RuleWizard";
import { useRulesPageActions } from "./useRulesPageActions";
import { DEFAULT_SITE } from "./rulesPageUtils";
import { SiteList } from "./components/SiteList";
import { EmptyState } from "./components/EmptyState";

export function RulesPage() {
  const {
    config, saving,
    editingKey, setEditingKey,
    recentlySavedKey,
    handleNewSite,
    handleWizardApply,
    handleWizardClose,
    toggleEnabled,
    deleteSite,
    getRuleStatus,
    quickSave,
  } = useRulesPageActions();

  if (!config) {
    return (
      <div className="p-5 text-sm" style={{ color: "var(--color-text-muted)" }}>
        正在加载...
      </div>
    );
  }

  const websites = config.websites;
  const siteKeys = Object.keys(websites);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 shrink-0">
        <PageHeader
          title={editingKey ? (websites[editingKey] ? "编辑规则" : "新建规则") : "规则管理"}
          subtitle={
            editingKey
              ? "完成所有步骤后点击「应用到网站配置」保存"
              : "为每个站点配置章节解析规则，向导会引导你完成每一步"
          }
          actions={
            editingKey ? (
              <Button variant="secondary" size="sm" onClick={handleWizardClose}>
                <ChevronLeft className="w-3.5 h-3.5" />
                返回列表
              </Button>
            ) : (
              <Button size="sm" onClick={handleNewSite} disabled={saving}>
                <Plus className="w-3.5 h-3.5" />
                新建规则
              </Button>
            )
          }
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {siteKeys.length === 0 && editingKey === null && (
          <EmptyState onNew={handleNewSite} />
        )}

        {/* ── Wizard panel ────────────────────────────────────────────────── */}
        {editingKey && (
          <RuleWizard
            site={websites[editingKey] ?? DEFAULT_SITE}
            onApply={(patch) => handleWizardApply(editingKey, patch)}
            onClose={handleWizardClose}
          />
        )}

        {/* ── Site list ───────────────────────────────────────────────────── */}
        {siteKeys.length > 0 && !editingKey && (
          <SiteList
            siteKeys={siteKeys}
            websites={websites}
            getRuleStatus={getRuleStatus}
            recentlySavedKey={recentlySavedKey}
            onEdit={(key) => setEditingKey(key)}
            onToggle={toggleEnabled}
            onDelete={deleteSite}
            onQuickSave={quickSave}
          />
        )}
      </div>
    </div>
  );
}

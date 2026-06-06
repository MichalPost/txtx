/**
 * RulesPage — 规则管理页面
 *
 * 两种操作入口：
 * - 向导模式：引导普通用户一步步配置规则
 * - 列表模式：快速浏览和编辑已有站点规则
 */
import { ChevronLeft, FileDown, Plus, Upload } from "lucide-react";

import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { RuleWizard } from "@/components/rule-wizard/RuleWizard";

import { EmptyState } from "./components/EmptyState";
import { SiteList } from "./components/SiteList";
import { DEFAULT_SITE } from "./rulesPageUtils";
import { useRulesPageActions } from "./useRulesPageActions";

export function RulesPage() {
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
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5">
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
        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {siteKeys.length === 0 && editingKey === null && <EmptyState onNew={handleNewSite} />}

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
            onReorder={reorderSites}
            onDuplicate={duplicateSite}
          />
        )}
      </div>
    </div>
  );
}

/**
 * RuleWizard 规则向导主容器。
 * 使用 7 步分页式流程，将更新列表、目录规则、正文规则和保存配置串联起来。
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookMarked,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  ListTree,
  RefreshCw,
  Save,
  TestTube2,
  Wand2,
} from "lucide-react";

import { Button } from "@/components/Button";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import type { WebsiteConfig } from "@/types";

import {
  emptyFieldRule,
  emptyWizardData,
  wizardDataFromSite,
  type WizardData,
} from "./ruleUtils";
import { WizardStep1UpdateList } from "./WizardStep1UpdateList";
import { WizardStep2SelectBook } from "./WizardStep2SelectBook";
import { WizardStep3ListTest } from "./WizardStep3ListTest";
import { WizardStep4ChapRules } from "./WizardStep4ChapRules";
import { WizardStep6Save } from "./WizardStep6Save";
import { WizardStepChapTestAndCleanup } from "./WizardStepChapTestAndCleanup";
import { WizardStepCatalog } from "./WizardStepCatalog";
import { canEnterWizardStep, getCompletedWizardSteps, type WizardStepId } from "./wizardFlowUtils";
import type { TargetField } from "./xpathTool";

const XPathToolPanel = lazy(async () => {
  const mod = await import("./XPathToolPanel");
  return { default: mod.XPathToolPanel };
});

const STEPS = [
  { id: 1, label: "更新列表抓取", icon: RefreshCw },
  { id: 2, label: "选择目标书籍", icon: BookMarked },
  { id: 3, label: "目录页抓取", icon: ListTree },
  { id: 4, label: "目录规则测试", icon: FlaskConical },
  { id: 5, label: "正文规则配置", icon: BookOpen },
  { id: 6, label: "正文提取测试", icon: TestTube2 },
  { id: 7, label: "保存站点规则", icon: Save },
] as const;

interface RuleWizardProps {
  site: WebsiteConfig;
  onApply: (patch: Partial<WebsiteConfig>) => void | Promise<void>;
  onClose: () => void;
}

export function RuleWizard({ site, onApply, onClose }: RuleWizardProps) {
  const [step, setStep] = useState(1);
  const initialData = useMemo(() => {
    const hasExistingRules = Boolean(
      site.list_novel_name ||
        site.release_url ||
        site.novel_content ||
        site.novel_name_x ||
        site.chapter_url_x,
    );
    return hasExistingRules
      ? wizardDataFromSite(site)
      : emptyWizardData(site.domain_name, site.encoding ?? "");
  }, [site]);
  const [data, setData] = useState<WizardData>(initialData);
  const [showXPathTool, setShowXPathTool] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const hasSavedRef = useRef(false);
  const xpathDialogRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setData(initialData);
    setStep(1);
    setShowXPathTool(false);
    hasSavedRef.current = false;
  }, [initialData]);

  useEffect(() => {
    if (!showXPathTool) return;

    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusDialog = () => {
      const container = xpathDialogRef.current;
      if (!container) return;

      const firstFocusable = container.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (firstFocusable ?? container).focus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowXPathTool(false);
        return;
      }

      if (event.key !== "Tab") return;

      const container = xpathDialogRef.current;
      if (!container) return;

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    focusDialog();
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      lastFocusedRef.current?.focus();
    };
  }, [showXPathTool]);

  const canEnterStep = (targetStep: number) => canEnterWizardStep(data, targetStep as WizardStepId);

  const goTo = (targetStep: number) => {
    if (!canEnterStep(targetStep) && targetStep > step) return;
    setShowXPathTool(false);

    if (targetStep === 3 && !data.catalog_html) {
      setData((current) => ({
        ...current,
        list_novel_name: emptyFieldRule("xpath"),
        list_release_url: emptyFieldRule("link_keyword"),
        list_release_date: emptyFieldRule("xpath"),
      }));
    }

    setStep(targetStep);
  };

  const goNext = () => goTo(Math.min(step + 1, STEPS.length));
  const goPrev = () => goTo(Math.max(step - 1, 1));

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(data) !== JSON.stringify(initialData),
    [data, initialData],
  );

  const handleCloseAttempt = async () => {
    if (!hasSavedRef.current && hasUnsavedChanges) {
      const confirmed = await confirm({
        title: "退出规则向导？",
        description: "当前向导还有未保存的数据，退出后这些修改不会写入规则配置。",
        confirmLabel: "退出",
        tone: "warning",
      });
      if (!confirmed) return;
    }
    onClose();
  };

  const xpathHtml =
    step === 1 ? data.update_list_html : step <= 4 ? data.catalog_html : data.chapter_html;

  const xpathPage: "catalog" | "chapter" | "update_list" =
    step === 1 ? "update_list" : step === 5 ? "chapter" : "catalog";

  const handleXPathToolApply = (result: Partial<Record<TargetField, string>>) => {
    const patch: Partial<WizardData> = {};

    if (step === 1) {
      if (result.update_book_name) {
        patch.list_novel_name = {
          ...data.list_novel_name,
          mode: "xpath",
          xpath: result.update_book_name,
        };
      }
      if (result.update_book_url) {
        patch.list_release_url = {
          ...data.list_release_url,
          mode: "xpath",
          xpath: result.update_book_url,
        };
      }
      if (result.update_book_date) {
        patch.list_release_date = {
          ...data.list_release_date,
          mode: "xpath",
          xpath: result.update_book_date,
        };
      }
    } else if (xpathPage === "catalog") {
      if (result.chapter_name) {
        patch.list_novel_name = {
          ...data.list_novel_name,
          mode: "xpath",
          xpath: result.chapter_name,
        };
      }
      if (result.chapter_url) {
        patch.list_release_url = {
          ...data.list_release_url,
          mode: "xpath",
          xpath: result.chapter_url,
        };
      }
      if (result.book_name) {
        patch.list_release_date = {
          ...data.list_release_date,
          mode: "xpath",
          xpath: result.book_name,
        };
      }
      if (result.book_intro) {
        patch.chap_intro = {
          ...data.chap_intro,
          mode: "xpath",
          xpath: result.book_intro,
        };
      }
    } else {
      if (result.novel_content) {
        patch.chap_content = {
          ...data.chap_content,
          mode: "xpath",
          xpath: result.novel_content,
        };
      }
      if (result.book_name) {
        patch.chap_novel_name = {
          ...data.chap_novel_name,
          mode: "xpath",
          xpath: result.book_name,
        };
      }
    }

    setData((current) => ({ ...current, ...patch }));
    setShowXPathTool(false);
  };

  const showXPathBtn = step === 1 || step === 3 || step === 5;

  const completedSteps = useMemo(() => getCompletedWizardSteps(data), [data]);

  return (
    <div
      className="flex flex-col gap-0 overflow-hidden rounded-xl border"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div
        className="flex shrink-0 items-center gap-3 border-b px-4 py-3"
        style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
        <span className="flex-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          规则向导
        </span>
        <span className="max-w-xs truncate text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {site.domain_name}
        </span>
      </div>

      <div
        className="flex shrink-0 items-stretch overflow-x-auto border-b"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
      >
        {STEPS.map(({ id, label, icon: Icon }) => {
          const active = step === id;
          const done = step > id || completedSteps[id as keyof typeof completedSteps];
          const locked = id > step && !canEnterStep(id);

          return (
            <button
              key={id}
              type="button"
              onClick={() => goTo(id)}
              disabled={locked}
              aria-current={active ? "step" : undefined}
              aria-label={`${active ? "当前步骤" : "步骤"} ${id}：${label}${locked ? "，暂不可进入" : ""}`}
              className="relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-all"
              style={{
                color: active
                  ? "var(--color-accent)"
                  : done
                    ? "var(--color-text-muted)"
                    : "var(--color-text-subtle)",
                background: active ? "var(--color-surface)" : "transparent",
                borderBottom: active ? "2px solid var(--color-accent)" : "2px solid transparent",
                fontWeight: active ? 600 : 400,
                opacity: locked ? 0.45 : 1,
                cursor: locked ? "not-allowed" : "pointer",
              }}
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]"
                style={{
                  background: active
                    ? "var(--color-accent)"
                    : done
                      ? "var(--color-success)"
                      : "var(--color-border)",
                  color: active || done ? "#fff" : "var(--color-text-subtle)",
                  fontWeight: 600,
                }}
              >
                {done ? "✓" : id}
              </span>
              <Icon className="h-3 w-3" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 520 }}>
        {step === 1 && <WizardStep1UpdateList data={data} onChange={setData} />}
        {step === 2 && <WizardStep2SelectBook data={data} onChange={setData} />}
        {step === 3 && <WizardStepCatalog data={data} onChange={setData} />}
        {step === 4 && <WizardStep3ListTest data={data} onChange={setData} />}
        {step === 5 && <WizardStep4ChapRules data={data} onChange={setData} />}
        {step === 6 && (
          <WizardStepChapTestAndCleanup
            data={data}
            onChange={setData}
            onGoToChapterRules={() => goTo(5)}
          />
        )}
        {step === 7 && (
          <WizardStep6Save
            data={data}
            onApply={async (patch) => {
              await onApply(patch);
              hasSavedRef.current = true;
            }}
            onClose={handleCloseAttempt}
          />
        )}
      </div>

      {showXPathTool &&
        createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center"
            style={{ zIndex: 9999, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
            onClick={() => setShowXPathTool(false)}
          >
            <div
              ref={xpathDialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="XPath 生成工具"
              tabIndex={-1}
              className="relative mx-4 w-full overflow-hidden rounded-xl"
              style={{
                maxWidth: 860,
                maxHeight: "calc(100vh - 64px)",
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <Suspense
                fallback={
                  <div
                    className="rounded-xl border px-4 py-4 text-sm"
                    style={{
                      background: "var(--color-surface)",
                      borderColor: "var(--color-border)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    正在加载 XPath 工具...
                  </div>
                }
              >
                <XPathToolPanel
                  html={xpathHtml}
                  page={xpathPage}
                  onApply={handleXPathToolApply}
                  onClose={() => setShowXPathTool(false)}
                />
              </Suspense>
            </div>
          </div>,
          document.body,
        )}

      <div
        className="flex shrink-0 items-center gap-2 border-t px-4 py-3"
        style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
        <Button variant="ghost" size="sm" onClick={goPrev} disabled={step === 1}>
          <ChevronLeft className="h-3.5 w-3.5" />
          上一步
        </Button>

        {showXPathBtn && (
          <button
            type="button"
            onClick={() => setShowXPathTool((value) => !value)}
            aria-pressed={showXPathTool}
            aria-label={showXPathTool ? "关闭 XPath 工具" : "打开 XPath 工具"}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: showXPathTool
                ? "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))"
                : "var(--color-surface-2)",
              borderColor: showXPathTool
                ? "color-mix(in srgb, var(--color-accent) 45%, transparent)"
                : "var(--color-border)",
              color: showXPathTool ? "var(--color-accent)" : "var(--color-text-muted)",
              fontWeight: showXPathTool ? 600 : 400,
            }}
          >
            <Wand2 className="h-3 w-3" />
            XPath 工具
          </button>
        )}

        <span className="flex-1 text-center text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {step} / {STEPS.length}
        </span>

        {step < STEPS.length && (
          <Button size="sm" onClick={goNext} disabled={!canEnterStep(step + 1)}>
            下一步
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}

        {step === STEPS.length && (
          <Button variant="ghost" size="sm" onClick={handleCloseAttempt}>
            关闭向导
          </Button>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}

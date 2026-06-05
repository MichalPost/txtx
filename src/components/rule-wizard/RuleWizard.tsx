/**
 * RuleWizard — 规则配置向导主容器
 * 7步 Tab 式向导（目录链接+规则合并为一步）
 *
 * 步骤：
 * 1. 更新列表页  — 输入 URL，拉取 HTML，配置书名/链接/日期规则 + 分页，实时预览书籍列表
 * 2. 选择书籍    — 从解析列表选一本，自动填入目录页 URL
 * 3. 目录规则    — 输入目录 URL，获取 HTML，配置章节列表规则，实时预览章节列表
 * 4. 目录测试    — 命中预览
 * 5. 章节规则    — 配置章节页规则（带 XPath 工具）
 * 6. 章节测试    — 命中预览
 * 7. 保存确认    — 汇总并应用到 WebsiteConfig
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  RefreshCw, BookMarked, ListTree,
  FlaskConical, BookOpen, TestTube2, Save,
  ChevronLeft, ChevronRight, Wand2,
} from "lucide-react";
import { Button } from "@/components/Button";
import { WizardStep1UpdateList } from "./WizardStep1UpdateList";
import { WizardStep2SelectBook } from "./WizardStep2SelectBook";
import { WizardStepCatalog } from "./WizardStepCatalog";
import { WizardStep3ListTest } from "./WizardStep3ListTest";
import { WizardStep4ChapRules } from "./WizardStep4ChapRules";
import { WizardStep5ChapTest } from "./WizardStep5ChapTest";
import { WizardStep6Save } from "./WizardStep6Save";
import { XPathToolPanel } from "./XPathToolPanel";
import { buildXPathFromRule, emptyWizardData, wizardDataFromSite } from "./ruleUtils";
import type { WizardData } from "./ruleUtils";
import type { TargetField } from "./xpathTool";
import type { WebsiteConfig } from "@/types";

// ─── Step metadata ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "更新列表页面获取", icon: RefreshCw },
  { id: 2, label: "更新列表书籍获取", icon: BookMarked },
  { id: 3, label: "目录规则",         icon: ListTree },
  { id: 4, label: "目录测试",         icon: FlaskConical },
  { id: 5, label: "章节规则",         icon: BookOpen },
  { id: 6, label: "章节测试",         icon: TestTube2 },
  { id: 7, label: "保存规则",         icon: Save },
] as const;

interface RuleWizardProps {
  site: WebsiteConfig;
  onApply: (patch: Partial<WebsiteConfig>) => void;
  onClose: () => void;
}

export function RuleWizard({ site, onApply, onClose }: RuleWizardProps) {
  const [step, setStep] = useState(1);
  const initialData = useMemo(() => {
    const hasExistingRules = Boolean(
      site.list_novel_name
      || site.release_url
      || site.novel_content
      || site.novel_name_x
      || site.chapter_url_x,
    );
    return hasExistingRules
      ? wizardDataFromSite(site)
      : emptyWizardData(site.domain_name, site.encoding ?? "");
  }, [site]);
  const [data, setData] = useState<WizardData>(initialData);
  const [showXPathTool, setShowXPathTool] = useState(false);
  const hasSavedRef = useRef(false);

  useEffect(() => {
    setData(initialData);
    setStep(1);
    setShowXPathTool(false);
    hasSavedRef.current = false;
  }, [initialData]);

  const canEnterStep = (targetStep: number) => {
    switch (targetStep) {
      case 2:
        return Boolean(data.update_books.length || data.catalog_url.trim());
      case 3:
        return Boolean(data.catalog_url.trim());
      case 4:
        return Boolean(buildXPathFromRule(data.list_novel_name) && buildXPathFromRule(data.list_release_url));
      case 5:
        return Boolean(data.chapter_test_url || data.selected_chapter_title || data.chapter_html);
      case 6:
        return Boolean(buildXPathFromRule(data.chap_content));
      case 7:
        return Boolean(
          data.catalog_url.trim()
          && buildXPathFromRule(data.list_novel_name)
          && buildXPathFromRule(data.list_release_url)
          && buildXPathFromRule(data.chap_content),
        );
      default:
        return true;
    }
  };

  const goTo = (n: number) => {
    if (!canEnterStep(n) && n > step) return;
    setShowXPathTool(false);
    setStep(n);
  };
  const goNext = () => goTo(Math.min(step + 1, STEPS.length));
  const goPrev = () => goTo(Math.max(step - 1, 1));
  const hasUnsavedChanges = useMemo(() => JSON.stringify(data) !== JSON.stringify(initialData), [data, initialData]);

  const handleCloseAttempt = () => {
    if (!hasSavedRef.current && hasUnsavedChanges) {
      const confirmed = confirm("当前规则向导还有未保存内容，确认要退出吗？");
      if (!confirmed) return;
    }
    onClose();
  };

  // Step 1 XPath tool → update list page
  // Step 3 XPath tool → catalog page
  // Step 5 XPath tool → chapter page
  const xpathHtml: string =
    step === 1 ? data.update_list_html
    : step <= 4 ? data.catalog_html
    : data.chapter_html;

  const xpathPage: "catalog" | "chapter" | "update_list" =
    step === 1 ? "update_list"
    : step === 5 || step === 6 ? "chapter"
    : "catalog";

  const handleXPathToolApply = (res: Partial<Record<TargetField, string>>) => {
    const patch: Partial<WizardData> = {};
    if (step === 1) {
      if (res.update_book_name) patch.list_novel_name   = { ...data.list_novel_name,   mode: "xpath", xpath: res.update_book_name };
      if (res.update_book_url)  patch.list_release_url  = { ...data.list_release_url,  mode: "xpath", xpath: res.update_book_url };
      if (res.update_book_date) patch.list_release_date = { ...data.list_release_date, mode: "xpath", xpath: res.update_book_date };
    } else if (xpathPage === "catalog") {
      if (res.chapter_name) patch.list_novel_name   = { ...data.list_novel_name,   mode: "xpath", xpath: res.chapter_name };
      if (res.chapter_url)  patch.list_release_url  = { ...data.list_release_url,  mode: "xpath", xpath: res.chapter_url };
      if (res.book_name)    patch.list_release_date = { ...data.list_release_date, mode: "xpath", xpath: res.book_name };
    } else {
      if (res.novel_content) patch.chap_content    = { ...data.chap_content,    mode: "xpath", xpath: res.novel_content };
      if (res.book_name)     patch.chap_novel_name = { ...data.chap_novel_name, mode: "xpath", xpath: res.book_name };
    }
    setData((d) => ({ ...d, ...patch }));
    setShowXPathTool(false);
  };

  // XPath tool button is available on steps 1, 3, 5
  const showXPathBtn = step === 1 || step === 3 || step === 5;

  const completedSteps = useMemo(() => ({
    1: Boolean(data.update_list_url.trim() && data.update_list_html),
    2: Boolean(data.selected_book_url || data.catalog_url.trim()),
    3: Boolean(data.catalog_url.trim() && data.catalog_html && buildXPathFromRule(data.list_novel_name) && buildXPathFromRule(data.list_release_url)),
    4: Boolean(data.chapter_test_url),
    5: Boolean(buildXPathFromRule(data.chap_content)),
    6: Boolean(data.chapter_html),
    7: false,
  }), [data]);

  return (
    <div
      className="flex flex-col gap-0 rounded-xl border overflow-hidden"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
        style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
        <span className="text-sm font-semibold flex-1" style={{ color: "var(--color-text)" }}>
          规则配置向导
        </span>
        <span className="text-xs truncate max-w-xs" style={{ color: "var(--color-text-subtle)" }}>
          {site.domain_name}
        </span>
      </div>

      {/* ── Step tabs ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-stretch border-b shrink-0 overflow-x-auto"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
      >
        {STEPS.map(({ id, label, icon: Icon }) => {
          const active = step === id;
          const done   = step > id || completedSteps[id as keyof typeof completedSteps];
          const locked = id > step && !canEnterStep(id);
          return (
            <button
              key={id}
              onClick={() => goTo(id)}
              disabled={locked}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all relative shrink-0 whitespace-nowrap"
              style={{
                color: active ? "var(--color-accent)" : done ? "var(--color-text-muted)" : "var(--color-text-subtle)",
                background: active ? "var(--color-surface)" : "transparent",
                borderBottom: active ? "2px solid var(--color-accent)" : "2px solid transparent",
                fontWeight: active ? 600 : 400,
                opacity: locked ? 0.45 : 1,
                cursor: locked ? "not-allowed" : "pointer",
              }}
            >
              <span
                className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center shrink-0"
                style={{
                  background: active ? "var(--color-accent)" : done ? "var(--color-success)" : "var(--color-border)",
                  color: active || done ? "#fff" : "var(--color-text-subtle)",
                  fontWeight: 600,
                }}
              >
                {done ? "✓" : id}
              </span>
              <Icon className="w-3 h-3" />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Step content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 520 }}>
        {step === 1 && <WizardStep1UpdateList data={data} onChange={setData} />}
        {step === 2 && <WizardStep2SelectBook data={data} onChange={setData} />}
        {step === 3 && <WizardStepCatalog     data={data} onChange={setData} />}
        {step === 4 && <WizardStep3ListTest   data={data} onChange={setData} />}
        {step === 5 && <WizardStep4ChapRules  data={data} onChange={setData} />}
        {step === 6 && <WizardStep5ChapTest   data={data} onChange={setData} />}
        {step === 7 && <WizardStep6Save data={data} onApply={(patch) => {
          hasSavedRef.current = true;
          onApply(patch);
        }} onClose={handleCloseAttempt} />}
      </div>

      {/* ── XPath tool modal (portal to body, no parent clipping) ──────────── */}
      {showXPathTool && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 9999, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
          onClick={() => setShowXPathTool(false)}
        >
          <div
            className="relative w-full mx-4 overflow-hidden rounded-xl"
            style={{
              maxWidth: 860,
              maxHeight: "calc(100vh - 64px)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <XPathToolPanel
              html={xpathHtml}
              page={xpathPage}
              onApply={handleXPathToolApply}
              onClose={() => setShowXPathTool(false)}
            />
          </div>
        </div>,
        document.body,
      )}

      {/* ── Footer navigation ──────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-t shrink-0"
        style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
        <Button variant="ghost" size="sm" onClick={goPrev} disabled={step === 1}>
          <ChevronLeft className="w-3.5 h-3.5" />
          上一步
        </Button>

        {showXPathBtn && (
          <button
            onClick={() => setShowXPathTool((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
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
            <Wand2 className="w-3 h-3" />
            XPath 工具
          </button>
        )}

        <span className="flex-1 text-center text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {step} / {STEPS.length}
        </span>

        {step < STEPS.length && (
          <Button size="sm" onClick={goNext} disabled={!canEnterStep(step + 1)}>
            下一步
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        )}

        {step === STEPS.length && (
          <Button variant="ghost" size="sm" onClick={handleCloseAttempt}>
            关闭向导
          </Button>
        )}      </div>
    </div>
  );
}

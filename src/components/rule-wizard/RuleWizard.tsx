/**
 * RuleWizard — 规则配置向导主容器
 * 6步 Tab 式向导，内嵌在 WebsiteEditor 展开区
 *
 * 步骤：
 * 1. 目录链接  — 输入 URL，可预拉取验证
 * 2. 目录规则  — 配置列表页解析规则（书名/日期/链接）
 * 3. 目录页测试 — 命中预览 + 源码高亮
 * 4. 章节规则  — 配置章节页解析规则（书名/内容/链接）
 * 5. 章节页测试 — 同上
 * 6. 保存确认  — 汇总并应用到 WebsiteConfig
 */
import { useState } from "react";
import {
  Link2, ListTree, FlaskConical, BookOpen, TestTube2, Save, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/Button";
import { WizardStep1Url } from "./WizardStep1Url";
import { WizardStep2ListRules } from "./WizardStep2ListRules";
import { WizardStep3ListTest } from "./WizardStep3ListTest";
import { WizardStep4ChapRules } from "./WizardStep4ChapRules";
import { WizardStep5ChapTest } from "./WizardStep5ChapTest";
import { WizardStep6Save } from "./WizardStep6Save";
import { emptyWizardData } from "./ruleUtils";
import type { WizardData } from "./ruleUtils";
import type { WebsiteConfig } from "@/types";

// ─── Step metadata ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "目录链接",   shortLabel: "链接",  icon: Link2 },
  { id: 2, label: "目录规则",   shortLabel: "规则",  icon: ListTree },
  { id: 3, label: "目录测试",   shortLabel: "测试",  icon: FlaskConical },
  { id: 4, label: "章节规则",   shortLabel: "章节",  icon: BookOpen },
  { id: 5, label: "章节测试",   shortLabel: "测试",  icon: TestTube2 },
  { id: 6, label: "保存预设",   shortLabel: "保存",  icon: Save },
] as const;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface RuleWizardProps {
  site: WebsiteConfig;
  onApply: (patch: Partial<WebsiteConfig>) => void;
  onClose: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function RuleWizard({ site, onApply, onClose }: RuleWizardProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(() =>
    emptyWizardData(site.domain_name)
  );

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length));
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));

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
        <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
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
          const done = step > id;
          return (
            <button
              key={id}
              onClick={() => setStep(id)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all relative shrink-0 whitespace-nowrap"
              style={{
                color: active
                  ? "var(--color-accent)"
                  : done
                    ? "var(--color-text-muted)"
                    : "var(--color-text-subtle)",
                background: active ? "var(--color-surface)" : "transparent",
                borderBottom: active
                  ? "2px solid var(--color-accent)"
                  : "2px solid transparent",
                fontWeight: active ? 600 : 400,
              }}
            >
              {/* Step number badge */}
              <span
                className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center shrink-0"
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
              <Icon className="w-3 h-3" />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Step content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 520 }}>
        {step === 1 && <WizardStep1Url data={data} onChange={setData} />}
        {step === 2 && <WizardStep2ListRules data={data} onChange={setData} />}
        {step === 3 && <WizardStep3ListTest data={data} onChange={setData} />}
        {step === 4 && <WizardStep4ChapRules data={data} onChange={setData} />}
        {step === 5 && <WizardStep5ChapTest data={data} onChange={setData} />}
        {step === 6 && <WizardStep6Save data={data} onApply={onApply} onClose={onClose} />}
      </div>

      {/* ── Footer navigation ──────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-t shrink-0"
        style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={goPrev}
          disabled={step === 1}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          上一步
        </Button>
        <span className="flex-1 text-center text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {step} / {STEPS.length}
        </span>
        {step < STEPS.length ? (
          <Button size="sm" onClick={goNext}>
            下一步
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

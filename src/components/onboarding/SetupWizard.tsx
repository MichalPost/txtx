/**
 * SetupWizard — 首次运行引导
 *
 * 3 步：欢迎 → 选择目录 → 完成
 * 只在 Tauri 模式下出现；完成后写入 base_dir 并标记 setup_complete。
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, CheckCircle2, ChevronRight, FolderOpen } from "lucide-react";

import { Button } from "@/components/Button";
import { apiCompleteSetup, apiPickDirectory } from "@/lib/api";

// ─── 动效变体 ─────────────────────────────────────────────────────────────────

const stepVariants = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

const stepTransition = {
  duration: 0.18,
  ease: [0.25, 0, 0, 1] as const, // easeOutQuart
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="rounded-full transition-all duration-200"
          style={{
            width: i === current ? 20 : 8,
            height: 8,
            background: i === current ? "var(--color-accent)" : "var(--color-border)",
          }}
        />
      ))}
    </div>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function Step1Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Icon */}
      <div
        className="flex items-center justify-center rounded-2xl"
        style={{
          width: 72,
          height: 72,
          background: "var(--color-accent-muted)",
          border: "1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)",
          boxShadow: "var(--shadow-accent)",
        }}
      >
        <BookOpen className="h-8 w-8" style={{ color: "var(--color-accent)" }} />
      </div>

      {/* Copy */}
      <div className="flex max-w-xs flex-col gap-2">
        <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 600, color: "var(--color-text)" }}>
          欢迎使用 txtx
        </h2>
        <p
          style={{
            fontSize: "var(--text-base)",
            color: "var(--color-text-muted)",
            lineHeight: 1.6,
          }}
        >
          帮你把喜欢的故事搬进书架。只需两步，就能开始下载。
        </p>
      </div>

      <Button size="lg" onClick={onNext}>
        开始设置
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function Step2Dir({
  baseDir,
  onDirChange,
  onNext,
  onBack,
}: {
  baseDir: string;
  onDirChange: (d: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = async () => {
    setPicking(true);
    try {
      const picked = await apiPickDirectory();
      if (picked) onDirChange(picked);
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, color: "var(--color-text)" }}>
          书放在哪里？
        </h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          选一个文件夹，下载的小说都会存在这里。
        </p>
      </div>

      {/* Dir picker */}
      <div className="flex flex-col gap-2">
        <div
          className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
          style={{
            background: "var(--color-surface-2)",
            borderColor: baseDir ? "var(--color-accent)" : "var(--color-border)",
            boxShadow: baseDir ? "0 0 0 3px var(--color-accent-muted)" : "none",
            transition: "border-color 150ms, box-shadow 150ms",
          }}
          onClick={() => inputRef.current?.focus()}
        >
          <FolderOpen
            className="h-4 w-4 shrink-0"
            style={{ color: baseDir ? "var(--color-accent)" : "var(--color-text-subtle)" }}
          />
          <input
            ref={inputRef}
            type="text"
            value={baseDir}
            onChange={(e) => onDirChange(e.target.value)}
            placeholder="例：D:\Books 或点击右侧选择..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: baseDir ? "var(--color-text)" : "var(--color-text-subtle)" }}
          />
          <button
            className="shrink-0 rounded-lg px-2 py-1 text-xs transition-colors"
            style={{
              background: "var(--color-accent-muted)",
              color: "var(--color-accent)",
              fontWeight: 500,
            }}
            onClick={handlePick}
            disabled={picking}
          >
            {picking ? "…" : "浏览"}
          </button>
        </div>

        {baseDir && (
          <p className="pl-1 text-xs" style={{ color: "var(--color-text-subtle)" }}>
            将自动创建 temp/ 和 logs/ 子目录。
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="md" onClick={onNext} disabled={!baseDir.trim()}>
          继续
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="md" onClick={onBack}>
          返回
        </Button>
      </div>
    </div>
  );
}

function Step3Done({
  baseDir,
  onFinish,
  saving,
}: {
  baseDir: string;
  onFinish: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Animated check */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
        className="flex items-center justify-center rounded-2xl"
        style={{
          width: 72,
          height: 72,
          background: "var(--color-success-bg)",
          border: "1px solid color-mix(in srgb, var(--color-success) 25%, transparent)",
        }}
      >
        <CheckCircle2 className="h-8 w-8" style={{ color: "var(--color-success)" }} />
      </motion.div>

      <div className="flex max-w-xs flex-col gap-2">
        <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 600, color: "var(--color-text)" }}>
          好了，可以开始了
        </h2>
        <p
          style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", lineHeight: 1.6 }}
        >
          书架已经准备好，放在
        </p>
        <code
          className="rounded-xl px-3 py-2 text-xs break-all"
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
          }}
        >
          {baseDir}
        </code>
      </div>

      <Button size="lg" onClick={onFinish} disabled={saving}>
        {saving ? "保存中…" : "开始使用"}
      </Button>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [baseDir, setBaseDir] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trap focus inside wizard
  const wizardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    wizardRef.current?.focus();
  }, []);

  const handleFinish = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiCompleteSetup(baseDir.trim());
      onComplete();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  };

  const steps = [
    <Step1Welcome key="welcome" onNext={() => setStep(1)} />,
    <Step2Dir
      key="dir"
      baseDir={baseDir}
      onDirChange={setBaseDir}
      onNext={() => setStep(2)}
      onBack={() => setStep(0)}
    />,
    <Step3Done key="done" baseDir={baseDir} onFinish={handleFinish} saving={saving} />,
  ];

  return (
    /* Full-screen backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "var(--color-bg)" }}
    >
      {/* Card */}
      <motion.div
        ref={wizardRef}
        tabIndex={-1}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.25, 0, 0, 1] }}
        className="flex flex-col gap-8 rounded-2xl p-8 outline-none"
        style={{
          width: 420,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Step dots */}
        <StepDots total={3} current={step} />

        {/* Step content — slides horizontally */}
        <div className="overflow-hidden" style={{ minHeight: 220 }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={stepTransition}
            >
              {steps[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Error message */}
        {error && (
          <p
            className="rounded-lg px-3 py-2 text-xs"
            style={{
              background: "var(--color-danger-bg)",
              color: "var(--color-danger)",
              border: "1px solid var(--color-danger)",
            }}
          >
            保存失败：{error}
          </p>
        )}
      </motion.div>
    </div>
  );
}

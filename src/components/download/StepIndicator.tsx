import { useEffect, useRef } from "react";
import { ScanSearch, ListChecks, Download, CheckCircle } from "lucide-react";
import { animateStepActivate } from "@/lib/animations";

interface StepIndicatorProps {
  phase: string;
}

export function StepIndicator({ phase }: StepIndicatorProps) {
  const steps = [
    { key: "scan", label: "扫描", icon: ScanSearch },
    { key: "preview", label: "选择", icon: ListChecks },
    { key: "download", label: "下载", icon: Download },
  ];
  const activeStep =
    phase === "scanning" ? 0
    : phase === "preview" ? 1
    : phase === "downloading" || phase === "done" ? 2
    : -1;

  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevActive = useRef(-1);

  useEffect(() => {
    if (activeStep !== prevActive.current && activeStep >= 0) {
      const el = stepRefs.current[activeStep];
      if (el) animateStepActivate(el);
      prevActive.current = activeStep;
    }
  }, [activeStep]);

  return (
    <div className="flex items-center">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isActive = idx === activeStep;
        const isDone = idx < activeStep || phase === "done";
        return (
          <div key={step.key} className="flex items-center">
            <div
              ref={(el) => { stepRefs.current[idx] = el; }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={{
                background: isActive
                  ? "var(--color-accent)"
                  : isDone
                  ? "color-mix(in srgb, var(--color-success) 15%, transparent)"
                  : "var(--color-surface-2)",
                color: isActive ? "#fff" : isDone ? "var(--color-success)" : "var(--color-text-muted)",
              }}
            >
              {isDone && !isActive ? <CheckCircle className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
              {step.label}
            </div>
            {idx < steps.length - 1 && (
              <div
                className="w-6 h-px mx-1"
                style={{ background: idx < activeStep ? "var(--color-success)" : "var(--color-border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

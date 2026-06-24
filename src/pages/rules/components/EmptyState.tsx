import { useEffect, useRef } from "react";
import { FileJson, Plus, Upload, Wand2 } from "lucide-react";

import { Button } from "@/components/Button";
import { animateFadeInUp } from "@/lib/animations";

interface EmptyStateProps {
  onImport: () => void;
  onNew: () => void;
  onTemplate: () => void;
}

export function EmptyState({ onImport, onNew, onTemplate }: EmptyStateProps) {
  const iconRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (iconRef.current) animateFadeInUp(iconRef.current, 0);
    if (textRef.current) animateFadeInUp(textRef.current, 80);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-20">
      <div
        ref={iconRef}
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          background: "var(--color-accent-muted)",
          border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
          boxShadow: "var(--shadow-accent)",
          opacity: 0,
        }}
      >
        <Wand2 className="h-7 w-7" style={{ color: "var(--color-accent)" }} />
      </div>

      <div ref={textRef} className="text-center" style={{ opacity: 0 }}>
        <p
          className="font-semibold"
          style={{ color: "var(--color-text)", fontSize: "var(--text-lg, 16px)" }}
        >
          还没有站点规则
        </p>
        <div
          className="mt-3 grid gap-2 text-left text-xs sm:grid-cols-3"
          style={{ color: "var(--color-text-muted)", maxWidth: "42rem", margin: "12px auto 0" }}
        >
          {["新建向导抓取真实页面", "导入已有 JSON 规则", "下载模板后批量编辑"].map((item) => (
            <span
              key={item}
              className="rounded-xl border px-3 py-2"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div
        className="flex flex-wrap items-center justify-center gap-2"
        style={{ opacity: 0, animation: "fadeIn 250ms ease-out 200ms forwards" }}
      >
        <Button onClick={onNew}>
          <Plus className="h-4 w-4" />
          新建规则向导
        </Button>
        <Button variant="secondary" onClick={onImport}>
          <Upload className="h-4 w-4" />
          导入规则
        </Button>
        <Button variant="secondary" onClick={onTemplate}>
          <FileJson className="h-4 w-4" />
          下载模板
        </Button>
      </div>

      <style>{`
        @keyframes fadeIn { to { opacity: 1; } }
      `}</style>
    </div>
  );
}

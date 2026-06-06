import { useEffect, useRef } from "react";
import { Plus, Wand2 } from "lucide-react";

import { Button } from "@/components/Button";
import { animateFadeInUp } from "@/lib/animations";

export function EmptyState({ onNew }: { onNew: () => void }) {
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
        <p
          className="mt-1.5 text-sm leading-relaxed"
          style={{ color: "var(--color-text-muted)", maxWidth: "28ch", margin: "6px auto 0" }}
        >
          添加一个站点，向导会帮你配置目录页和章节页的解析方式
        </p>
      </div>

      <Button
        onClick={onNew}
        style={{ opacity: 0, animation: "fadeIn 250ms ease-out 200ms forwards" }}
      >
        <Plus className="h-4 w-4" />
        新建规则向导
      </Button>

      <style>{`
        @keyframes fadeIn { to { opacity: 1; } }
      `}</style>
    </div>
  );
}

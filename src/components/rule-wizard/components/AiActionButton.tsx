import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/Button";

interface AiActionButtonProps {
  enabled: boolean;
  loading: boolean;
  loadingLabel: string;
  idleLabel: string;
  onRun: () => void;
  onEnable: () => void;
  hint?: string;
}

export function AiActionButton({
  enabled,
  loading,
  loadingLabel,
  idleLabel,
  onRun,
  onEnable,
  hint,
}: AiActionButtonProps) {
  if (enabled) {
    return (
      <>
        <Button size="sm" onClick={onRun} disabled={loading}>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {loading ? loadingLabel : idleLabel}
        </Button>
        {hint && (
          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            {hint}
          </span>
        )}
      </>
    );
  }

  return (
    <button
      onClick={onEnable}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
      style={{
        background: "var(--color-surface-1)",
        borderColor: "var(--color-border)",
        color: "var(--color-text-subtle)",
      }}
    >
      <Sparkles className="h-3 w-3" style={{ color: "var(--color-text-subtle)" }} />
      AI 未启用（点此开启）
    </button>
  );
}

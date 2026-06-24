import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/Button";

import { AiActionButton } from "./AiActionButton";
import { SourceToggleButton } from "./SourceToggleButton";

interface RuleQuickToolsProps {
  autoLabel: string;
  autoLoading: boolean;
  onAutoMatch: () => void;
  commonRules: { label: string; value: string }[];
  onCommonRule: (xpath: string) => void | Promise<void>;
  selectFlex?: string;
  sourceActive: boolean;
  sourceLabel: string;
  onToggleSource: () => void;
  aiEnabled: boolean;
  aiBusy: boolean;
  onBatchAi: () => void;
  onEnableAi: () => void;
}

export function RuleQuickTools({
  autoLabel,
  autoLoading,
  onAutoMatch,
  commonRules,
  onCommonRule,
  selectFlex = "1 1 160px",
  sourceActive,
  sourceLabel,
  onToggleSource,
  aiEnabled,
  aiBusy,
  onBatchAi,
  onEnableAi,
}: RuleQuickToolsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" onClick={onAutoMatch} disabled={autoLoading}>
        {autoLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
        {autoLabel}
      </Button>

      <select
        name={`${autoLabel}-common-rule`}
        aria-label={`选择${autoLabel}常用规则`}
        className="rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
        style={{
          background: "var(--color-surface-1)",
          borderColor: "var(--color-border)",
          color: "var(--color-text)",
          flex: selectFlex,
          minWidth: 0,
        }}
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v) void onCommonRule(v);
        }}
      >
        {commonRules.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      <SourceToggleButton active={sourceActive} label={sourceLabel} onClick={onToggleSource} />

      <AiActionButton
        enabled={aiEnabled}
        loading={aiBusy}
        loadingLabel="AI 分析中..."
        idleLabel="AI 批量分析"
        onRun={onBatchAi}
        onEnable={onEnableAi}
      />
    </div>
  );
}

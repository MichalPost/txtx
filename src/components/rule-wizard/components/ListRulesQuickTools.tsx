import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/Button";

import { AiActionButton } from "./AiActionButton";
import { SourceToggleButton } from "./SourceToggleButton";

interface ListRulesQuickToolsProps {
  autoMatchLoading: boolean;
  onAutoMatch: () => void;
  commonRules: { label: string; value: string }[];
  onCommonRule: (xpath: string) => void;
  encoding: string;
  encodingOptions: { label: string; value: string }[];
  onEncodingChange: (encoding: string) => void;
  sourceActive: boolean;
  onToggleSource: () => void;
  aiEnabled: boolean;
  aiLoading: boolean;
  onBatchAi: () => void;
  onEnableAi: () => void;
}

export function ListRulesQuickTools({
  autoMatchLoading,
  onAutoMatch,
  commonRules,
  onCommonRule,
  encoding,
  encodingOptions,
  onEncodingChange,
  sourceActive,
  onToggleSource,
  aiEnabled,
  aiLoading,
  onBatchAi,
  onEnableAi,
}: ListRulesQuickToolsProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onAutoMatch} disabled={autoMatchLoading}>
          {autoMatchLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          自动匹配
        </Button>

        <select
          className="rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
          style={{
            background: "var(--color-surface-1)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
            flex: "1 1 160px",
            minWidth: 0,
          }}
          value=""
          onChange={(e) => onCommonRule(e.target.value)}
        >
          {commonRules.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            编码
          </span>
          <select
            className="rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
            style={{
              background: "var(--color-surface-1)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
              minWidth: 90,
            }}
            value={encoding}
            onChange={(e) => onEncodingChange(e.target.value)}
          >
            {encodingOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <SourceToggleButton active={sourceActive} label="原代码" onClick={onToggleSource} />
      </div>

      <div className="mt-1 flex items-center gap-2">
        <AiActionButton
          enabled={aiEnabled}
          loading={aiLoading}
          loadingLabel="AI 分析中..."
          idleLabel="AI 批量分析"
          onRun={onBatchAi}
          onEnable={onEnableAi}
          hint={aiEnabled ? "自动生成所有字段规则" : undefined}
        />
      </div>
    </>
  );
}

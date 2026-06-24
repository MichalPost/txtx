import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

import {
  buildDraftListFeedback,
  formatDraftFeedback,
  isValidRegexPattern,
} from "./blacklistEditorUtils";
import { inlineInputClass, inlineInputStyle, inputFocusHandlers } from "./blacklistUtils";

interface RegexPanelProps {
  patterns: string[];
  onUpdate: (patterns: string[]) => void;
}

export function RegexPanel({ patterns, onUpdate }: RegexPanelProps) {
  const [newRegex, setNewRegex] = useState("");
  const [inputHint, setInputHint] = useState<string | null>(null);

  const addRegex = () => {
    const feedback = buildDraftListFeedback([newRegex], patterns, isValidRegexPattern);
    if (feedback.accepted.length === 0) {
      if (feedback.invalidEntries.length > 0) {
        setInputHint(`正则无效：${feedback.invalidEntries[0]}`);
      } else {
        setInputHint(formatDraftFeedback(0, feedback.duplicateValues.length, feedback.emptyCount));
      }
      return;
    }

    onUpdate([...patterns, ...feedback.accepted]);
    setNewRegex("");
    setInputHint("正则已加入列表，记得保存配置");
  };

  const removeRegex = (value: string) => {
    onUpdate(patterns.filter((pattern) => pattern !== value));
    setInputHint(`已移除正则「${value}」，变更尚未保存`);
  };

  return (
    <Card title="正则规则" className="flex flex-col">
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            className={`flex-1 font-mono ${inlineInputClass}`}
            style={inlineInputStyle}
            placeholder="正则表达式"
            value={newRegex}
            onChange={(e) => setNewRegex(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRegex()}
            {...inputFocusHandlers}
          />
          <Button size="sm" onClick={addRegex}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p
          className="text-xs"
          style={{ color: inputHint ? "var(--color-warning)" : "var(--color-text-subtle)" }}
        >
          {inputHint ?? "输入合法正则表达式，空值、重复值和非法表达式会被拦截"}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        {patterns.map((pattern) => (
          <div
            key={pattern}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5"
            style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}
          >
            <code
              className="flex-1 truncate font-mono text-xs"
              style={{ color: "var(--color-accent)" }}
            >
              {pattern}
            </code>
            <button
              onClick={() => removeRegex(pattern)}
              aria-label={`删除正则 ${pattern}`}
              title={`删除正则 ${pattern}`}
              className="cursor-pointer transition-colors"
              style={{ color: "var(--color-text-muted)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {patterns.length === 0 && (
          <div
            className="rounded-xl border border-dashed px-4 py-5 text-center text-xs"
            style={{
              color: "var(--color-text-muted)",
              borderColor: "var(--color-border)",
              background: "var(--color-surface-2)",
            }}
          >
            还没有正则规则，可以先用关键词过滤；需要更精准时再补正则
          </div>
        )}
      </div>
    </Card>
  );
}

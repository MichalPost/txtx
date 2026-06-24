import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

import { buildDraftListFeedback, formatDraftFeedback } from "./blacklistEditorUtils";
import { inlineInputClass, inlineInputStyle, inputFocusHandlers } from "./blacklistUtils";

interface TagPanelProps {
  tags: string[];
  onUpdate: (tags: string[]) => void;
}

export function TagPanel({ tags, onUpdate }: TagPanelProps) {
  const [newTag, setNewTag] = useState("");
  const [inputHint, setInputHint] = useState<string | null>(null);

  const addTag = () => {
    const feedback = buildDraftListFeedback([newTag], tags);
    if (feedback.accepted.length === 0) {
      setInputHint(formatDraftFeedback(0, feedback.duplicateValues.length, feedback.emptyCount));
      return;
    }

    onUpdate([...tags, ...feedback.accepted]);
    setNewTag("");
    setInputHint("标签已加入过滤列表，记得保存配置");
  };

  const removeTag = (value: string) => {
    onUpdate(tags.filter((tag) => tag !== value));
    setInputHint(`已移除标签「${value}」，变更尚未保存`);
  };

  return (
    <Card title="标签过滤">
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            className={`flex-1 ${inlineInputClass}`}
            style={inlineInputStyle}
            placeholder="输入标签名按 Enter 添加"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            {...inputFocusHandlers}
          />
          <Button size="sm" onClick={addTag}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p
          className="text-xs"
          style={{ color: inputHint ? "var(--color-warning)" : "var(--color-text-subtle)" }}
        >
          {inputHint ?? "适合拦截固定标签，如“广告”“番外”“机器翻译”"}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              aria-label={`删除标签 ${tag}`}
              title={`删除标签 ${tag}`}
              className="cursor-pointer rounded-full p-0.5"
              style={{ color: "var(--color-text-muted)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
              }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
        {tags.length === 0 && (
          <div
            className="w-full rounded-xl border border-dashed px-4 py-5 text-center text-xs"
            style={{
              color: "var(--color-text-muted)",
              borderColor: "var(--color-border)",
              background: "var(--color-surface-2)",
            }}
          >
            还没有标签过滤项，启用标签过滤后可在这里补充需要拦截的标签
          </div>
        )}
      </div>
    </Card>
  );
}

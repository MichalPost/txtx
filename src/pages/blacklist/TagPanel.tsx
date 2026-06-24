import { useMemo, useState } from "react";
import { ClipboardList, Plus, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useConfirmDialog } from "@/components/ConfirmDialog";

import {
  buildDraftListFeedback,
  filterDraftValuesByQuery,
  formatDraftFeedback,
  splitDraftValues,
} from "./blacklistEditorUtils";
import { inlineInputClass, inlineInputStyle, inputFocusHandlers } from "./blacklistUtils";

interface TagPanelProps {
  tags: string[];
  onUpdate: (tags: string[]) => void;
}

export function TagPanel({ tags, onUpdate }: TagPanelProps) {
  const [newTag, setNewTag] = useState("");
  const [bulkDraft, setBulkDraft] = useState("");
  const [query, setQuery] = useState("");
  const [inputHint, setInputHint] = useState<string | null>(null);
  const [deleteVisiblePending, setDeleteVisiblePending] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const visibleTags = useMemo(() => filterDraftValuesByQuery(tags, query), [query, tags]);

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

  const addBulkTags = () => {
    const feedback = buildDraftListFeedback(splitDraftValues(bulkDraft), tags);
    if (feedback.accepted.length === 0) {
      setInputHint(
        formatDraftFeedback(0, feedback.duplicateValues.length, feedback.emptyCount) ??
          "没有可导入的新标签",
      );
      return;
    }

    onUpdate([...tags, ...feedback.accepted]);
    setBulkDraft("");
    setInputHint(
      formatDraftFeedback(
        feedback.accepted.length,
        feedback.duplicateValues.length,
        feedback.emptyCount,
      ),
    );
  };

  const removeTag = (value: string) => {
    onUpdate(tags.filter((tag) => tag !== value));
    setInputHint(`已移除标签「${value}」，变更尚未保存`);
  };

  const removeVisibleTags = async () => {
    if (visibleTags.length === 0 || deleteVisiblePending) return;
    const tagsToRemove = [...visibleTags];
    setDeleteVisiblePending(true);
    const confirmed = await confirm({
      title: `删除 ${tagsToRemove.length} 个标签过滤项？`,
      description: "将删除当前筛选出的标签过滤项。保存配置前，刷新页面仍可放弃这次草稿修改。",
      confirmLabel: "删除结果",
      tone: "danger",
    }).catch(() => false);
    setDeleteVisiblePending(false);
    if (!confirmed) return;

    const visibleSet = new Set(tagsToRemove);
    onUpdate(tags.filter((tag) => !visibleSet.has(tag)));
    setInputHint(`已删除 ${tagsToRemove.length} 个标签过滤项，变更尚未保存`);
  };

  return (
    <Card title="标签过滤">
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            className={`flex-1 ${inlineInputClass}`}
            style={inlineInputStyle}
            name="blacklist-tag-new"
            aria-label="新增标签过滤项"
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
        <div
          className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
        >
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
          <input
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            style={{ color: "var(--color-text)" }}
            name="blacklist-tag-search"
            aria-label="搜索标签过滤项"
            placeholder="搜索已有标签"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              aria-label="清空标签搜索"
              title="清空标签搜索"
              onClick={() => setQuery("")}
              className="rounded p-0.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <textarea
          className="min-h-20 rounded-lg border px-3 py-2 text-xs outline-none transition-colors"
          name="blacklist-tag-bulk"
          aria-label="批量添加标签过滤项"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-surface-2)",
            color: "var(--color-text)",
          }}
          placeholder="批量粘贴标签，支持换行、逗号、顿号分隔"
          value={bulkDraft}
          onChange={(e) => setBulkDraft(e.target.value)}
          {...inputFocusHandlers}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            {query ? `显示 ${visibleTags.length} / ${tags.length} 个标签` : `共 ${tags.length} 个标签`}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={addBulkTags} disabled={!bulkDraft.trim()}>
              <ClipboardList className="h-3.5 w-3.5" />
              批量加入
            </Button>
            {query ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void removeVisibleTags()}
                disabled={visibleTags.length === 0 || deleteVisiblePending}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleteVisiblePending ? "确认中..." : "删除结果"}
              </Button>
            ) : null}
          </div>
        </div>
        <p
          className="text-xs"
          style={{ color: inputHint ? "var(--color-warning)" : "var(--color-text-subtle)" }}
        >
          {inputHint ?? "适合拦截固定标签，如“广告”“番外”“机器翻译”"}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visibleTags.map((tag) => (
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
        {tags.length === 0 ? (
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
        ) : null}
        {tags.length > 0 && visibleTags.length === 0 ? (
          <div
            className="w-full rounded-xl border border-dashed px-4 py-5 text-center text-xs"
            style={{
              color: "var(--color-text-muted)",
              borderColor: "var(--color-border)",
              background: "var(--color-surface-2)",
            }}
          >
            没有匹配当前搜索的标签
          </div>
        ) : null}
      </div>
      {confirmDialog}
    </Card>
  );
}

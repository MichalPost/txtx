import { useMemo, useState } from "react";
import { ClipboardList, Plus, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useConfirmDialog } from "@/components/ConfirmDialog";

import {
  buildDraftListFeedback,
  filterDraftValuesByQuery,
  formatDraftFeedback,
  isValidRegexPattern,
  splitDraftValues,
} from "./blacklistEditorUtils";
import { inlineInputClass, inlineInputStyle, inputFocusHandlers } from "./blacklistUtils";

interface RegexPanelProps {
  patterns: string[];
  onUpdate: (patterns: string[]) => void;
}

export function RegexPanel({ patterns, onUpdate }: RegexPanelProps) {
  const [newRegex, setNewRegex] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [search, setSearch] = useState("");
  const [inputHint, setInputHint] = useState<string | null>(null);
  const [deleteVisiblePending, setDeleteVisiblePending] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const visiblePatterns = useMemo(
    () => filterDraftValuesByQuery(patterns, search),
    [patterns, search],
  );
  const bulkFeedback = useMemo(
    () => buildDraftListFeedback(splitDraftValues(bulkText), patterns, isValidRegexPattern),
    [bulkText, patterns],
  );

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

  const addBulkRegex = () => {
    if (bulkFeedback.accepted.length === 0) {
      setInputHint(
        formatDraftFeedback(
          0,
          bulkFeedback.duplicateValues.length,
          bulkFeedback.emptyCount,
          bulkFeedback.invalidEntries.length,
        ) ?? "没有可添加的正则",
      );
      return;
    }

    onUpdate([...patterns, ...bulkFeedback.accepted]);
    setInputHint(
      formatDraftFeedback(
        bulkFeedback.accepted.length,
        bulkFeedback.duplicateValues.length,
        bulkFeedback.emptyCount,
        bulkFeedback.invalidEntries.length,
      ),
    );
    setBulkText("");
    setBulkMode(false);
  };

  const removeVisiblePatterns = async () => {
    if (visiblePatterns.length === 0 || deleteVisiblePending) return;
    const patternsToRemove = [...visiblePatterns];
    setDeleteVisiblePending(true);
    const confirmed = await confirm({
      title: `删除 ${patternsToRemove.length} 条正则？`,
      description: "将删除当前搜索结果中的黑名单正则。保存配置前，刷新页面仍可放弃这次草稿修改。",
      confirmLabel: "删除结果",
      tone: "danger",
    }).catch(() => false);
    setDeleteVisiblePending(false);
    if (!confirmed) {
      return;
    }
    const visibleSet = new Set(patternsToRemove);
    onUpdate(patterns.filter((pattern) => !visibleSet.has(pattern)));
    setInputHint(`已删除 ${patternsToRemove.length} 条正则，变更尚未保存`);
    setSearch("");
  };

  return (
    <Card
      title="正则规则"
      className="flex flex-col"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBulkMode((value) => !value)}
            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors"
            style={{
              borderColor: bulkMode ? "var(--color-accent)" : "var(--color-border)",
              color: bulkMode ? "var(--color-accent)" : "var(--color-text-muted)",
              background: bulkMode ? "var(--color-accent-muted)" : "transparent",
            }}
          >
            <ClipboardList className="h-3 w-3" /> 批量
          </button>
          <span
            className="rounded-lg px-2 py-1 text-xs"
            style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
          >
            {patterns.length} 条
          </span>
        </div>
      }
    >
      <div className="mb-3 flex flex-col gap-2">
        {bulkMode && (
          <div
            className="flex flex-col gap-2 rounded-xl border p-3"
            style={{ background: "var(--color-surface-1)", borderColor: "var(--color-accent)" }}
          >
            <textarea
              rows={4}
              className="w-full resize-y rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none"
              name="regex-bulk-input"
              aria-label="批量添加黑名单正则"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              placeholder={"广告.*\n推广.{0,8}\n^测试书名$"}
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              {...inputFocusHandlers}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                {bulkFeedback.accepted.length} 条可添加
                {bulkFeedback.duplicateValues.length > 0 &&
                  `，${bulkFeedback.duplicateValues.length} 条重复`}
                {bulkFeedback.invalidEntries.length > 0 &&
                  `，${bulkFeedback.invalidEntries.length} 条无效`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBulkMode(false);
                    setBulkText("");
                  }}
                  className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
                >
                  <X className="h-3 w-3" /> 取消
                </button>
                <button
                  type="button"
                  onClick={addBulkRegex}
                  disabled={bulkFeedback.accepted.length === 0}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs disabled:opacity-40"
                  style={{ background: "var(--color-accent)", color: "#fff" }}
                >
                  <Plus className="h-3 w-3" /> 批量添加
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <label htmlFor="new-blacklist-regex" className="sr-only">
            新增黑名单正则
          </label>
          <input
            id="new-blacklist-regex"
            className={`flex-1 font-mono ${inlineInputClass}`}
            style={inlineInputStyle}
            name="new-blacklist-regex"
            aria-label="新增黑名单正则"
            placeholder="正则表达式"
            value={newRegex}
            onChange={(e) => setNewRegex(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRegex()}
            {...inputFocusHandlers}
          />
          <Button size="sm" onClick={addRegex} aria-label="添加黑名单正则" title="添加黑名单正则">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p
          className="text-xs"
          style={{ color: inputHint ? "var(--color-warning)" : "var(--color-text-subtle)" }}
        >
          {inputHint ?? "输入合法正则表达式，空值、重复值和非法表达式会被拦截"}
        </p>
        <div
          className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
        >
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-subtle)" }} />
          <label htmlFor="blacklist-regex-search" className="sr-only">
            搜索黑名单正则
          </label>
          <input
            id="blacklist-regex-search"
            className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
            style={{ color: "var(--color-text)" }}
            name="blacklist-regex-search"
            placeholder="搜索正则规则"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="搜索黑名单正则"
          />
          {search.trim() && (
            <>
              <button
                type="button"
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
                onClick={() => setSearch("")}
              >
                清除
              </button>
              <button
                type="button"
                className="text-xs"
                style={{ color: "var(--color-danger)" }}
                onClick={() => void removeVisiblePatterns()}
                disabled={visiblePatterns.length === 0 || deleteVisiblePending}
              >
                {deleteVisiblePending ? "确认中..." : "删除结果"}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {visiblePatterns.map((pattern) => (
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
        {patterns.length > 0 && visiblePatterns.length === 0 && (
          <div
            className="rounded-xl border border-dashed px-4 py-5 text-center text-xs"
            style={{
              color: "var(--color-text-muted)",
              borderColor: "var(--color-border)",
              background: "var(--color-surface-2)",
            }}
          >
            没有匹配的正则规则
          </div>
        )}
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
      {confirmDialog}
    </Card>
  );
}

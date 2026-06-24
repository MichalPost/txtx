import { useMemo, useState } from "react";
import { ClipboardList, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";

import { Card } from "@/components/Card";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import {
  buildDraftListFeedback,
  filterDraftValuesByQuery,
  formatDraftFeedback,
  splitDraftValues,
} from "@/pages/blacklist/blacklistEditorUtils";

interface Props {
  whitelist: string[];
  onUpdate: (list: string[]) => void;
}

export function WhitelistPanel({ whitelist, onUpdate }: Props) {
  const [input, setInput] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [search, setSearch] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [deleteVisiblePending, setDeleteVisiblePending] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const visibleWhitelist = useMemo(
    () => filterDraftValuesByQuery(whitelist, search),
    [search, whitelist],
  );
  const bulkFeedback = useMemo(
    () => buildDraftListFeedback(splitDraftValues(bulkText), whitelist),
    [bulkText, whitelist],
  );

  const add = () => {
    const feedback = buildDraftListFeedback([input], whitelist);
    if (feedback.accepted.length === 0) {
      setHint(formatDraftFeedback(0, feedback.duplicateValues.length, feedback.emptyCount));
      return;
    }
    onUpdate([...whitelist, ...feedback.accepted]);
    setInput("");
    setHint("已加入白名单，记得保存配置");
  };

  const addBulk = () => {
    if (bulkFeedback.accepted.length === 0) {
      setHint(
        formatDraftFeedback(0, bulkFeedback.duplicateValues.length, bulkFeedback.emptyCount) ??
          "没有可添加的白名单条目",
      );
      return;
    }
    onUpdate([...whitelist, ...bulkFeedback.accepted]);
    setHint(
      formatDraftFeedback(
        bulkFeedback.accepted.length,
        bulkFeedback.duplicateValues.length,
        bulkFeedback.emptyCount,
      ),
    );
    setBulkText("");
    setBulkMode(false);
  };

  const remove = (kw: string) => {
    onUpdate(whitelist.filter((w) => w !== kw));
    setHint(`已移除「${kw}」，变更尚未保存`);
  };

  const removeVisible = async () => {
    if (visibleWhitelist.length === 0 || deleteVisiblePending) return;
    const itemsToRemove = [...visibleWhitelist];
    setDeleteVisiblePending(true);
    const confirmed = await confirm({
      title: `删除 ${itemsToRemove.length} 个白名单条目？`,
      description: "将删除当前搜索结果中的白名单条目。保存配置前，刷新页面仍可放弃这次草稿修改。",
      confirmLabel: "删除结果",
      tone: "danger",
    }).catch(() => false);
    setDeleteVisiblePending(false);
    if (!confirmed) {
      return;
    }
    const visibleSet = new Set(itemsToRemove);
    onUpdate(whitelist.filter((item) => !visibleSet.has(item)));
    setHint(`已删除 ${itemsToRemove.length} 个白名单条目，变更尚未保存`);
    setSearch("");
  };

  return (
    <Card
      title="白名单"
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
            {whitelist.length} 条
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          白名单中的书名即使匹配关键词也不会被过滤
        </p>

        {bulkMode && (
          <div
            className="flex flex-col gap-2 rounded-xl border p-3"
            style={{ background: "var(--color-surface-1)", borderColor: "var(--color-accent)" }}
          >
            <textarea
              rows={4}
              className="w-full resize-y rounded-lg border px-3 py-2 text-xs focus:outline-none"
              name="whitelist-bulk-input"
              aria-label="批量添加白名单条目"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              placeholder={"不会误杀的书名\n重点追更作品\n作者名片段"}
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                {bulkFeedback.accepted.length} 条可添加
                {bulkFeedback.duplicateValues.length > 0 &&
                  `，${bulkFeedback.duplicateValues.length} 条重复`}
                {bulkFeedback.emptyCount > 0 && `，${bulkFeedback.emptyCount} 条空白`}
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
                  onClick={addBulk}
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
          <label htmlFor="new-whitelist-entry" className="sr-only">
            新增白名单条目
          </label>
          <input
            id="new-whitelist-entry"
            className="flex-1 rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
            name="new-whitelist-entry"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
            placeholder="书名，按 Enter 添加"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            aria-label="新增白名单条目"
          />
          <button
            type="button"
            onClick={add}
            className="flex items-center justify-center rounded-lg px-2 py-1.5"
            style={{ background: "var(--color-accent)", color: "#fff" }}
            aria-label="添加白名单条目"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <p
          className="text-xs"
          style={{ color: hint ? "var(--color-warning)" : "var(--color-text-subtle)" }}
        >
          {hint ?? "空值和重复值会被拦截；建议只加入确实需要豁免的书名或作者片段"}
        </p>

        <div
          className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
        >
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-subtle)" }} />
          <label htmlFor="whitelist-search" className="sr-only">
            搜索白名单条目
          </label>
          <input
            id="whitelist-search"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            name="whitelist-search"
            style={{ color: "var(--color-text)" }}
            placeholder="搜索白名单"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="搜索白名单条目"
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
                onClick={() => void removeVisible()}
                disabled={visibleWhitelist.length === 0 || deleteVisiblePending}
              >
                {deleteVisiblePending ? "确认中..." : "删除结果"}
              </button>
            </>
          )}
        </div>

        <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
          {whitelist.length > 0 && visibleWhitelist.length === 0 && (
            <p
              className="w-full rounded-lg border border-dashed py-3 text-center text-xs"
              style={{ color: "var(--color-text-subtle)", borderColor: "var(--color-border)" }}
            >
              没有匹配的白名单条目
            </p>
          )}
          {whitelist.length === 0 && (
            <p
              className="w-full py-2 text-center text-xs"
              style={{ color: "var(--color-text-subtle)" }}
            >
              还没有白名单条目
            </p>
          )}
          {visibleWhitelist.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
              style={{
                background: "var(--color-success-bg)",
                borderColor: "color-mix(in srgb, var(--color-success) 30%, transparent)",
                color: "var(--color-success)",
              }}
            >
              <ShieldCheck className="h-2.5 w-2.5" />
              {kw}
              <button
                type="button"
                onClick={() => remove(kw)}
                className="ml-0.5 hover:opacity-60"
                style={{ color: "var(--color-success)" }}
                aria-label={`删除白名单条目 ${kw}`}
                title={`删除白名单条目 ${kw}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
      {confirmDialog}
    </Card>
  );
}

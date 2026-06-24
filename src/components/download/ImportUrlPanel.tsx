import { useMemo, useRef, useState } from "react";
import { AlertCircle, Download, FileUp, Link2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { Textarea } from "@/components/Input";
import { formatToolActionError } from "@/lib/toolActionError";
import { summarizeImportedUrls, type ImportUrlSummary } from "./importUrlPanelUtils";

interface ImportUrlPanelProps {
  onImport: (urls: string[], summary: ImportUrlSummary) => void | Promise<void>;
  onClose: () => void;
  taskMode?: boolean;
}

export function ImportUrlPanel({ onImport, onClose, taskMode = false }: ImportUrlPanelProps) {
  const [text, setText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => summarizeImportedUrls(text), [text]);
  const urls = summary.urls;
  const importLabel = taskMode ? "创建任务" : "批量下载";

  const handleFile = async (file: File) => {
    try {
      const content = await file.text();
      setText(content);
      toast.success(`已读取文件：${file.name}`);
    } catch (error) {
      toast.error(formatToolActionError("读取导入文件", error));
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = "";
  };

  const handleImport = async () => {
    if (urls.length === 0) return;
    setSubmitting(true);
    try {
      await onImport(urls, summary);
      onClose();
    } catch (error) {
      toast.error(formatToolActionError(importLabel, error));
    } finally {
      setSubmitting(false);
    }
  };

  const cleanInput = () => {
    if (!summary.normalizedText) return;
    setText(summary.normalizedText);
    toast.success(`已清洗为 ${summary.validCount} 条唯一链接`);
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-4"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div className="flex items-center gap-2">
        <FileUp className="h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          批量导入 URL
        </span>
        <button
          onClick={onClose}
          className="ml-auto rounded-md p-0.5 transition-opacity hover:opacity-70"
          style={{ color: "var(--color-text-muted)" }}
          aria-label="关闭导入面板"
          disabled={submitting}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs leading-5" style={{ color: "var(--color-text-muted)" }}>
        每行粘贴一个小说链接，也可以直接拖入 `.txt` 或 `.csv` 文件。系统会自动忽略空行和无效内容。
      </p>

      <div
        className="relative rounded-lg border-2 transition-colors"
        style={{
          borderColor: dragOver ? "var(--color-accent)" : "var(--color-border)",
          borderStyle: "dashed",
          background: dragOver
            ? "color-mix(in srgb, var(--color-accent) 5%, var(--color-surface))"
            : "var(--color-surface)",
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Textarea
          id="import-url-list"
          name="import-url-list"
          rows={7}
          placeholder={[
            "每行一个小说 URL，例如：",
            "https://example.com/novel/12345",
            "https://example.com/novel/67890",
            "",
            "也可以把 txt / csv 文件拖进来",
          ].join("\n")}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="rounded-lg border-0 focus:ring-0"
          style={{ background: "transparent" }}
          disabled={submitting}
          aria-label="批量导入 URL 列表"
        />
        {dragOver && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg"
            style={{ background: "color-mix(in srgb, var(--color-accent) 8%, transparent)" }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--color-accent)" }}>
              松开即可导入文件
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:opacity-80"
          style={{
            background: "var(--color-surface-1)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-muted)",
          }}
          onClick={() => fileInputRef.current?.click()}
          disabled={submitting}
        >
          <FileUp className="h-3.5 w-3.5" />
          选择文件（.txt / .csv）
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "var(--color-surface-1)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-muted)",
          }}
          onClick={cleanInput}
          disabled={submitting || urls.length === 0 || text.trim() === summary.normalizedText}
        >
          <Link2 className="h-3.5 w-3.5" />
          清洗输入
        </button>
        <label htmlFor="import-url-file" className="sr-only">
          选择 URL 导入文件
        </label>
        <input
          id="import-url-file"
          name="import-url-file"
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv"
          className="hidden"
          onChange={handleFileInput}
          disabled={submitting}
          aria-label="选择 URL 导入文件"
        />

        {text.trim() && (
          <div className="ml-auto flex flex-wrap items-center gap-2 max-sm:w-full max-sm:justify-start">
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{
                background: "color-mix(in srgb, var(--color-success) 15%, transparent)",
                color: "var(--color-success)",
              }}
            >
              <Link2 className="mr-1 inline h-3 w-3" />
              保留 {summary.validCount} 条可导入链接
            </span>
            {summary.duplicateCount > 0 && (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 14%, transparent)",
                  color: "var(--color-accent)",
                }}
              >
                <AlertCircle className="mr-1 inline h-3 w-3" />
                去重 {summary.duplicateCount} 条重复链接
              </span>
            )}
            {summary.invalidCount > 0 && (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: "color-mix(in srgb, var(--color-warning) 14%, transparent)",
                  color: "var(--color-warning)",
                }}
              >
                <AlertCircle className="mr-1 inline h-3 w-3" />
                忽略 {summary.invalidCount} 条无效内容
              </span>
            )}
          </div>
        )}
      </div>

      {summary.invalidSamples.length > 0 ? (
        <div
          className="rounded-lg border px-3 py-2 text-xs leading-5"
          style={{
            borderColor: "color-mix(in srgb, var(--color-warning) 24%, transparent)",
            background: "var(--color-warning-bg)",
            color: "var(--color-warning)",
          }}
        >
          已忽略无效内容：{summary.invalidSamples.join("、")}
          {summary.invalidCount > summary.invalidSamples.length
            ? ` 等 ${summary.invalidCount} 条`
            : ""}
        </div>
      ) : null}

      {urls.length > 0 && (
        <div
          className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border px-3 py-2"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
        >
          {urls.slice(0, 8).map((value, index) => (
            <p
              key={`${value}-${index}`}
              className="truncate text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              <span
                className="mr-1 inline-block w-4 text-center tabular-nums"
                style={{ color: "var(--color-text-subtle)" }}
              >
                {index + 1}
              </span>
              {value}
            </p>
          ))}
          {urls.length > 8 && (
            <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
              还有 {urls.length - 8} 条链接未展开显示
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
          取消
        </Button>
        <Button size="sm" onClick={() => void handleImport()} disabled={urls.length === 0 || submitting}>
          <Download className="h-3.5 w-3.5" />
          {submitting ? `${importLabel}中...` : `${importLabel} ${urls.length} 条链接`}
        </Button>
      </div>
    </div>
  );
}

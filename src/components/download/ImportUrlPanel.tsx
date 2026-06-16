import { useRef, useState } from "react";
import { AlertCircle, Download, FileUp, Link2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { Textarea } from "@/components/Input";

// ─── URL Extraction ───────────────────────────────────────────────────────────

function extractUrls(text: string): string[] {
  return text
    .split(/[\n\r,;]+/)
    .map((l) => l.trim())
    .filter((l) => /^https?:\/\/.{5,}/.test(l));
}

// ─── ImportUrlPanel ───────────────────────────────────────────────────────────

interface ImportUrlPanelProps {
  onImport: (urls: string[]) => void | Promise<void>;
  onClose: () => void;
  /** If true, show "创建任务" label; otherwise show "开始下载" */
  taskMode?: boolean;
}

export function ImportUrlPanel({ onImport, onClose, taskMode = false }: ImportUrlPanelProps) {
  const [text, setText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const urls = extractUrls(text);

  const handleFile = async (file: File) => {
    const content = await file.text();
    setText(content);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (urls.length === 0) return;
    setSubmitting(true);
    try {
      await onImport(urls);
      onClose();
    } catch (error) {
      toast.error(taskMode ? `创建任务失败：${String(error)}` : `开始下载失败：${String(error)}`);
    } finally {
      setSubmitting(false);
    }
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
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileUp className="h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          批量导入 URL
        </span>
        <button
          onClick={onClose}
          className="ml-auto rounded-md p-0.5 transition-opacity hover:opacity-70"
          style={{ color: "var(--color-text-muted)" }}
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Textarea + drop zone */}
      <div
        className="relative rounded-lg border-2 transition-colors"
        style={{
          borderColor: dragOver ? "var(--color-accent)" : "var(--color-border)",
          borderStyle: "dashed",
          background: dragOver
            ? "color-mix(in srgb, var(--color-accent) 5%, var(--color-surface))"
            : "var(--color-surface)",
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Textarea
          rows={6}
          placeholder={
            "每行一个 URL，例如：\nhttps://example.com/novel/12345\nhttps://example.com/novel/67890\n\n也可以直接拖拽 .txt 或 .csv 文件到此处"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="rounded-lg border-0 focus:ring-0"
          style={{ background: "transparent" }}
        />
        {dragOver && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg"
            style={{ background: "color-mix(in srgb, var(--color-accent) 8%, transparent)" }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--color-accent)" }}>
              松开鼠标以导入文件
            </p>
          </div>
        )}
      </div>

      {/* File picker */}
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:opacity-80"
          style={{
            background: "var(--color-surface-1)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-muted)",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileUp className="h-3.5 w-3.5" />
          选择文件（.txt / .csv）
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv"
          className="hidden"
          onChange={handleFileInput}
        />

        {/* URL count */}
        {text.trim() && (
          <div className="ml-auto flex items-center gap-1.5">
            {urls.length > 0 ? (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: "color-mix(in srgb, var(--color-success) 15%, transparent)",
                  color: "var(--color-success)",
                }}
              >
                <Link2 className="mr-1 inline h-3 w-3" />
                {urls.length} 个有效 URL
              </span>
            ) : (
              <span
                className="flex items-center gap-1 text-xs"
                style={{ color: "var(--color-warning)" }}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                未识别到 URL
              </span>
            )}
          </div>
        )}
      </div>

      {/* Preview list (up to 8) */}
      {urls.length > 0 && (
        <div
          className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border px-3 py-2"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
        >
          {urls.slice(0, 8).map((u, i) => (
            <p key={i} className="truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
              <span
                className="mr-1 inline-block w-4 text-center tabular-nums"
                style={{ color: "var(--color-text-subtle)" }}
              >
                {i + 1}
              </span>
              {u}
            </p>
          ))}
          {urls.length > 8 && (
            <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
              ... 还有 {urls.length - 8} 个
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
          取消
        </Button>
        <Button size="sm" onClick={() => void handleImport()} disabled={urls.length === 0 || submitting}>
          <Download className="h-3.5 w-3.5" />
          {submitting
            ? taskMode
              ? "创建中..."
              : "处理中..."
            : taskMode
              ? `创建 ${urls.length} 个任务`
              : `开始下载 ${urls.length} 个`}
        </Button>
      </div>
    </div>
  );
}

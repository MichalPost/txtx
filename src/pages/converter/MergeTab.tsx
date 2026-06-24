import { useState } from "react";
import { ClipboardPaste, FileText, FolderOpen, Merge, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { apiMergeFiles, apiPickDirectory, apiPickFile } from "@/lib/api";
import { formatToolActionError } from "@/lib/toolActionError";

import { ResultsCard } from "./ResultsCard";
import { countFilledPaths, parsePathImportDraft, type PathImportSummary } from "./converterUtils";
import type { ConvertResult } from "./types";
import { usePathList } from "./usePathList";

export function MergeTab() {
  const { items, paths, addPath, removePath, updatePath } = usePathList();
  const [output, setOutput] = useState("");
  const [results, setResults] = useState<ConvertResult[]>([]);
  const [bulkDraft, setBulkDraft] = useState("");
  const [bulkSummary, setBulkSummary] = useState<PathImportSummary | null>(null);
  const [running, setRunning] = useState(false);
  const validCount = countFilledPaths(paths);

  const pickInput = async (index: number) => {
    try {
      const file = await apiPickFile([{ name: "文本文件", extensions: ["txt"] }]);
      if (file) {
        updatePath(items[index].id, file);
        setResults([]);
      }
    } catch (error) {
      toast.error(formatToolActionError("选择输入文件", error));
    }
  };

  const pickOutput = async () => {
    try {
      const dir = await apiPickDirectory();
      if (dir) {
        setOutput(dir.replace(/\\/g, "/") + "/merged.txt");
        setResults([]);
      }
    } catch (error) {
      toast.error(formatToolActionError("选择输出目录", error));
    }
  };

  const handleMerge = async () => {
    const validPaths = paths.filter((path) => path.trim());
    if (!validPaths.length || !output.trim()) return;

    setRunning(true);
    setResults([]);
    try {
      const message = await apiMergeFiles(validPaths, output.trim());
      setResults([{ path: output, message, ok: true }]);
    } catch (error) {
      setResults([
        {
          path: output,
          message: formatToolActionError("合并文件", error),
          ok: false,
        },
      ]);
    } finally {
      setRunning(false);
    }
  };

  const handleBulkImport = () => {
    const summary = parsePathImportDraft(bulkDraft, paths);
    setBulkSummary(summary);
    if (summary.accepted.length === 0) return;

    summary.accepted.forEach((path) => addPath(path));
    setBulkDraft("");
    setResults([]);
    toast.success(`已添加 ${summary.accepted.length} 个文件路径`);
  };

  return (
    <>
      <Card title="要合并的文件（按顺序）" className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between text-xs">
          <p style={{ color: "var(--color-text-muted)" }}>
            当前队列 {validCount} 个文件，按列表顺序拼接
          </p>
          <p style={{ color: "var(--color-text-subtle)" }}>
            任一输入文件读取失败都会中止合并，避免静默丢内容
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-2">
              <span
                className="w-5 shrink-0 text-center text-xs"
                style={{ color: "var(--color-text-subtle)" }}
              >
                {index + 1}
              </span>
              <Input
                name={`merge-input-path-${index + 1}`}
                className="flex-1"
                placeholder="TXT 文件路径..."
                value={item.path}
                onChange={(event) => {
                  updatePath(item.id, event.target.value);
                  setResults([]);
                }}
                disabled={running}
              />
              <Button
                variant="secondary"
                size="md"
                onClick={() => void pickInput(index)}
                disabled={running}
                aria-label={`选择第 ${index + 1} 个输入文件`}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
              {items.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    removePath(item.id);
                    setResults([]);
                  }}
                  disabled={running}
                  aria-label={`删除第 ${index + 1} 个输入文件`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}

          <Button
            variant="secondary"
            size="sm"
            className="mt-1 self-start"
            onClick={() => {
              addPath();
              setResults([]);
            }}
            disabled={running}
          >
            <FileText className="h-3.5 w-3.5" /> 添加文件
          </Button>

          <div
            className="mt-2 rounded-xl border p-3"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
                批量粘贴路径
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBulkImport}
                disabled={running || !bulkDraft.trim()}
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                导入路径
              </Button>
            </div>
            <textarea
              name="merge-bulk-paths"
              className="min-h-20 w-full resize-y rounded-lg border px-3 py-2 font-mono text-xs outline-none"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              placeholder={"每行一个 TXT 路径，也支持用分号分隔\nD:/books/a.txt\nD:/books/b.txt"}
              value={bulkDraft}
              onChange={(event) => {
                setBulkDraft(event.target.value);
                setBulkSummary(null);
              }}
              disabled={running}
              aria-label="批量粘贴要合并的文件路径"
            />
            {bulkSummary && (
              <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                可导入 {bulkSummary.accepted.length} 个，重复 {bulkSummary.duplicateCount} 个，
                空项 {bulkSummary.emptyCount} 个
              </p>
            )}
          </div>
        </div>

        <div
          className="mt-3 flex flex-col gap-2 border-t pt-3"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <Input
              label="输出文件路径"
              className="flex-1"
              placeholder="D:/books/merged.txt"
              value={output}
              onChange={(event) => {
                setOutput(event.target.value);
                setResults([]);
              }}
              disabled={running}
            />
            <Button
              variant="secondary"
              size="md"
              onClick={() => void pickOutput()}
              className="mt-5"
              disabled={running}
              aria-label="选择输出目录"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="sm"
            onClick={() => void handleMerge()}
            disabled={running || validCount === 0 || !output.trim()}
            className="self-start"
          >
            <Merge className="h-3.5 w-3.5" />
            {running ? "合并中..." : "开始合并"}
          </Button>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-subtle)" }}>
            输出文件仍会覆盖同名目标，但现在会在读取任一源文件失败时直接报错并停止，避免误以为合并成功。
          </p>
        </div>
      </Card>

      <ResultsCard
        title="合并结果"
        emptyTitle="准备输出合并文件"
        emptyDescription="依次添加多个 TXT 文件并设置输出路径，执行后会在这里显示结果。"
        results={results}
        running={running}
        runningLabel="合并中..."
      />
    </>
  );
}

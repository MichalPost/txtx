import { useState } from "react";
import { CheckCircle, FileText, FolderOpen, Merge, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { apiMergeFiles, apiPickDirectory, apiPickFile } from "@/lib/api";
import { formatToolActionError } from "@/lib/toolActionError";

import type { ConvertResult } from "./types";
import { usePathList } from "./usePathList";

export function MergeTab() {
  const { paths, addPath, removePath, updatePath } = usePathList();
  const [output, setOutput] = useState("");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [running, setRunning] = useState(false);

  const pickInput = async (i: number) => {
    try {
      const f = await apiPickFile([{ name: "文本文件", extensions: ["txt"] }]);
      if (f) updatePath(i, f);
    } catch (error) {
      toast.error(formatToolActionError("选择输入文件", error));
    }
  };

  const pickOutput = async () => {
    try {
      const dir = await apiPickDirectory();
      if (dir) {
        // Suggest an output name inside that dir
        setOutput(dir.replace(/\\/g, "/") + "/merged.txt");
      }
    } catch (error) {
      toast.error(formatToolActionError("选择输出目录", error));
    }
  };

  const handleMerge = async () => {
    const valid = paths.filter((p) => p.trim());
    if (!valid.length || !output.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      const msg = await apiMergeFiles(valid, output.trim());
      setResult({ path: output, message: msg, ok: true });
    } catch (e) {
      setResult({ path: output, message: String(e), ok: false });
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Card title="要合并的文件（按顺序）" className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {paths.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="w-5 shrink-0 text-center text-xs"
                style={{ color: "var(--color-text-subtle)" }}
              >
                {i + 1}
              </span>
              <Input
                className="flex-1"
                placeholder="TXT 文件路径..."
                value={p}
                onChange={(e) => updatePath(i, e.target.value)}
              />
              <Button variant="secondary" size="md" onClick={() => void pickInput(i)}>
                <FolderOpen className="h-4 w-4" />
              </Button>
              {paths.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removePath(i)}>
                  ✕
                </Button>
              )}
            </div>
          ))}
          <Button variant="secondary" size="sm" className="mt-1 self-start" onClick={addPath}>
            <FileText className="h-3.5 w-3.5" /> 添加文件
          </Button>
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
              onChange={(e) => setOutput(e.target.value)}
            />
            <Button
              variant="secondary"
              size="md"
              onClick={() => void pickOutput()}
              className="mt-5"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="sm"
            onClick={() => void handleMerge()}
            disabled={running || paths.every((p) => !p.trim()) || !output.trim()}
            className="self-start"
          >
            <Merge className="h-3.5 w-3.5" />
            {running ? "合并中..." : "开始合并"}
          </Button>
          {result && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
              style={{
                background: result.ok ? "var(--color-success-bg)" : "var(--color-danger-bg)",
                color: result.ok ? "var(--color-success)" : "var(--color-danger)",
              }}
            >
              {result.ok ? (
                <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              <span>{result.message}</span>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

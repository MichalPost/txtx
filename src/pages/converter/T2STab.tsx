import { useState } from "react";
import { FileText, FolderOpen, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { apiConvertFile, apiPickFile } from "@/lib/api";
import { formatToolActionError } from "@/lib/toolActionError";

import { ResultsCard } from "./ResultsCard";
import { countFilledPaths } from "./converterUtils";
import type { ConvertResult } from "./types";
import { usePathList } from "./usePathList";

export function T2STab() {
  const { items, paths, addPath, removePath, updatePath } = usePathList();
  const [results, setResults] = useState<ConvertResult[]>([]);
  const [running, setRunning] = useState(false);
  const validCount = countFilledPaths(paths);

  const pickFile = async (index: number) => {
    try {
      const file = await apiPickFile([{ name: "文本文件", extensions: ["txt"] }]);
      if (file) {
        updatePath(items[index].id, file);
        setResults([]);
      }
    } catch (error) {
      toast.error(formatToolActionError("选择转换文件", error));
    }
  };

  const handleConvert = async () => {
    const validPaths = paths.filter((path) => path.trim());
    if (!validPaths.length) return;

    setRunning(true);
    setResults([]);

    const nextResults: ConvertResult[] = [];
    for (const path of validPaths) {
      try {
        const message = await apiConvertFile(path.trim());
        nextResults.push({ path, message, ok: true });
      } catch (error) {
        nextResults.push({
          path,
          message: formatToolActionError("转换文件", error),
          ok: false,
        });
      }
    }

    setResults(nextResults);
    setRunning(false);
  };

  return (
    <>
      <Card title="文件列表" className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between text-xs">
          <p style={{ color: "var(--color-text-muted)" }}>已选择 {validCount} 个待转换文件</p>
          <p style={{ color: "var(--color-text-subtle)" }}>
            自动识别 UTF-8 / GBK / Big5，并按需转成简体 UTF-8 文本
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-2">
              <Input
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
                onClick={() => void pickFile(index)}
                disabled={running}
                aria-label={`选择第 ${index + 1} 个文件`}
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
                  aria-label={`删除第 ${index + 1} 个文件`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}

          <div className="mt-1 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                addPath();
                setResults([]);
              }}
              disabled={running}
            >
              <FileText className="h-3.5 w-3.5" /> 添加文件
            </Button>
            <Button size="sm" onClick={() => void handleConvert()} disabled={running || validCount === 0}>
              <Play className="h-3.5 w-3.5" />
              {running ? "转换中..." : "开始转换"}
            </Button>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-subtle)" }}>
            结果会显示识别到的输入编码；如果文件本身已经是简体文本，也会保留原内容并明确说明。
          </p>
        </div>
      </Card>

      <ResultsCard
        title="批量转换结果"
        emptyTitle="准备批量转换"
        emptyDescription="添加一个或多个 TXT 文件后开始执行，右侧会汇总每个文件的处理结果。"
        results={results}
        running={running}
        runningLabel="转换中..."
      />
    </>
  );
}

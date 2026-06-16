import { useState } from "react";
import { FileText, FolderOpen, Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { apiConvertFile, apiPickFile } from "@/lib/api";
import { formatToolActionError } from "@/lib/toolActionError";

import { ResultsCard } from "./ResultsCard";
import type { ConvertResult } from "./types";
import { usePathList } from "./usePathList";

export function T2STab() {
  const { paths, addPath, removePath, updatePath } = usePathList();
  const [results, setResults] = useState<ConvertResult[]>([]);
  const [running, setRunning] = useState(false);

  const pickFile = async (i: number) => {
    try {
      const f = await apiPickFile([{ name: "文本文件", extensions: ["txt"] }]);
      if (f) updatePath(i, f);
    } catch (error) {
      toast.error(formatToolActionError("选择转换文件", error));
    }
  };

  const handleConvert = async () => {
    const valid = paths.filter((p) => p.trim());
    if (!valid.length) return;
    setRunning(true);
    setResults([]);
    const out: ConvertResult[] = [];
    for (const p of valid) {
      try {
        const msg = await apiConvertFile(p.trim());
        out.push({ path: p, message: msg, ok: true });
      } catch (e) {
        out.push({ path: p, message: String(e), ok: false });
      }
    }
    setResults(out);
    setRunning(false);
  };

  return (
    <>
      <Card title="文件列表" className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {paths.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="flex-1"
                placeholder="TXT 文件路径..."
                value={p}
                onChange={(e) => updatePath(i, e.target.value)}
              />
              <Button variant="secondary" size="md" onClick={() => void pickFile(i)}>
                <FolderOpen className="h-4 w-4" />
              </Button>
              {paths.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removePath(i)}>
                  ✕
                </Button>
              )}
            </div>
          ))}
          <div className="mt-1 flex gap-2">
            <Button variant="secondary" size="sm" onClick={addPath}>
              <FileText className="h-3.5 w-3.5" /> 添加文件
            </Button>
            <Button
              size="sm"
              onClick={() => void handleConvert()}
              disabled={running || paths.every((p) => !p.trim())}
            >
              <Play className="h-3.5 w-3.5" />
              {running ? "转换中..." : "开始转换"}
            </Button>
          </div>
        </div>
      </Card>
      {results.length > 0 && <ResultsCard results={results} running={running} />}
    </>
  );
}

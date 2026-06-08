import { useState } from "react";
import { CheckCircle, ChevronRight, FolderOpen, Scissors } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { apiPickFile, apiSplitFile } from "@/lib/api";

export function SplitTab() {
  const [path, setPath] = useState("");
  const [pattern, setPattern] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const pickFile = async () => {
    const f = await apiPickFile([{ name: "文本文件", extensions: ["txt"] }]);
    if (f) setPath(f);
  };

  const handleSplit = async () => {
    if (!path.trim()) return;
    setRunning(true);
    setResults([]);
    setError("");
    try {
      const files = await apiSplitFile(path.trim(), pattern.trim() || undefined);
      setResults(files);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card title="按章节标题分割" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <Input
            label="源文件"
            className="flex-1"
            placeholder="D:/books/novel.txt"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
          <Button variant="secondary" size="md" onClick={() => void pickFile()}>
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-1">
          <Input
            label="分割规则（正则，留空使用默认）"
            placeholder="^第[零一二三四五六七八九十百千\d]+[章节]"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          />
          <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            默认匹配：第X章、第X节、第X回等常见格式，输出文件保存到源文件同目录
          </p>
        </div>

        <Button
          size="sm"
          className="self-start"
          onClick={() => void handleSplit()}
          disabled={running || !path.trim()}
        >
          <Scissors className="h-3.5 w-3.5" />
          {running ? "分割中..." : "开始分割"}
        </Button>

        {error && (
          <div
            className="rounded-lg px-3 py-2 text-xs"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
          >
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium" style={{ color: "var(--color-success)" }}>
              <CheckCircle className="mr-1 inline h-3.5 w-3.5" />
              已生成 {results.length} 个文件
            </p>
            <div
              className="max-h-48 overflow-y-auto rounded-lg border p-2"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
            >
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <ChevronRight
                    className="h-3 w-3 shrink-0"
                    style={{ color: "var(--color-text-subtle)" }}
                  />
                  <span className="truncate font-mono" style={{ color: "var(--color-text-muted)" }}>
                    {r.split(/[/\\]/).pop()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

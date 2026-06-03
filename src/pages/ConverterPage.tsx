import { useState } from "react";
import { FileText, FolderOpen, Play, CheckCircle } from "lucide-react";
import { apiConvertFile, apiPickFile } from "@/lib/api";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";

interface ConvertResult {
  path: string;
  message: string;
  ok: boolean;
}

export function ConverterPage() {
  const [paths, setPaths] = useState<string[]>([""]);
  const [results, setResults] = useState<ConvertResult[]>([]);
  const [running, setRunning] = useState(false);

  const addPath = () => setPaths((p) => [...p, ""]);
  const removePath = (i: number) => setPaths((p) => p.filter((_, idx) => idx !== i));
  const updatePath = (i: number, v: string) =>
    setPaths((p) => p.map((x, idx) => (idx === i ? v : x)));

  const pickFile = async (i: number) => {
    const f = await apiPickFile([{ name: "文本文件", extensions: ["txt"] }]);
    if (f) updatePath(i, f);
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
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">
      <PageHeader
        title="批量文本转换"
        subtitle="繁体中文 → 简体中文，自动检测是否需要转换"
        actions={
          <Button size="sm" onClick={handleConvert} disabled={running || paths.every((p) => !p.trim())}>
            <Play className="w-3.5 h-3.5" />
            {running ? "转换中..." : "开始转换"}
          </Button>
        }
      />

      <div className="flex gap-4 flex-1 min-h-0">
        <Card title="文件列表" className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
            {paths.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  className="flex-1"
                  placeholder="TXT 文件路径..."
                  value={p}
                  onChange={(e) => updatePath(i, e.target.value)}
                />
                <Button variant="secondary" size="md" onClick={() => pickFile(i)}>
                  <FolderOpen className="w-4 h-4" />
                </Button>
                {paths.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removePath(i)}
                    className="text-[var(--color-danger)]">✕</Button>
                )}
              </div>
            ))}
            <Button variant="secondary" size="sm" className="self-start mt-1" onClick={addPath}>
              <FileText className="w-3.5 h-3.5" /> 添加文件
            </Button>
          </div>
        </Card>

        {(results.length > 0 || running) && (
          <Card title="转换结果" className="w-80 shrink-0 flex flex-col min-h-0">
            <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
              {running && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div
                    className="w-8 h-8 rounded-full border-2 animate-spin"
                    style={{
                      borderColor: "var(--color-border)",
                      borderTopColor: "var(--color-accent)",
                    }}
                  />
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>转换中...</p>
                </div>
              )}
              {results.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0"
                    style={{ color: r.ok ? "var(--color-success)" : "var(--color-danger)" }} />
                  <div>
                    <p className="font-medium truncate max-w-[220px]"
                      style={{ color: "var(--color-text)" }} title={r.path}>
                      {r.path.split(/[/\\]/).pop()}
                    </p>
                    <p style={{ color: r.ok ? "var(--color-text-muted)" : "var(--color-danger)" }}>
                      {r.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

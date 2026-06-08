import { useState } from "react";
import {
  CheckCircle,
  ChevronRight,
  FileText,
  FolderOpen,
  Languages,
  Merge,
  Play,
  RefreshCw,
  Scissors,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import {
  apiConvertFile,
  apiMergeFiles,
  apiPickDirectory,
  apiPickFile,
  apiSplitFile,
} from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolMode = "t2s" | "merge" | "split" | "encoding";

interface ConvertResult {
  path: string;
  message: string;
  ok: boolean;
}

const TABS: { id: ToolMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "t2s", label: "繁→简转换", icon: Languages },
  { id: "merge", label: "合并文件", icon: Merge },
  { id: "split", label: "按章分割", icon: Scissors },
  { id: "encoding", label: "编码转换", icon: RefreshCw },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ConverterPage() {
  const [mode, setMode] = useState<ToolMode>("t2s");

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-5">
      <PageHeader title="文本工具箱" subtitle="繁简转换、文件合并、章节分割" />

      {/* Tabs */}
      <div className="flex shrink-0 gap-0 border-b" style={{ borderColor: "var(--color-border)" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors"
            style={{
              color: mode === id ? "var(--color-accent)" : "var(--color-text-muted)",
              borderBottom: mode === id ? "2px solid var(--color-accent)" : "2px solid transparent",
              background: "transparent",
            }}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        {mode === "t2s" && <T2STab />}
        {mode === "merge" && <MergeTab />}
        {mode === "split" && <SplitTab />}
        {mode === "encoding" && <EncodingTab />}
      </div>
    </div>
  );
}

// ─── Tab: 繁→简 ──────────────────────────────────────────────────────────────

function T2STab() {
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

// ─── Tab: 合并文件 ────────────────────────────────────────────────────────────

function MergeTab() {
  const [paths, setPaths] = useState<string[]>([""]);
  const [output, setOutput] = useState("");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [running, setRunning] = useState(false);

  const addPath = () => setPaths((p) => [...p, ""]);
  const removePath = (i: number) => setPaths((p) => p.filter((_, idx) => idx !== i));
  const updatePath = (i: number, v: string) =>
    setPaths((p) => p.map((x, idx) => (idx === i ? v : x)));

  const pickInput = async (i: number) => {
    const f = await apiPickFile([{ name: "文本文件", extensions: ["txt"] }]);
    if (f) updatePath(i, f);
  };

  const pickOutput = async () => {
    const dir = await apiPickDirectory();
    if (dir) {
      // Suggest an output name inside that dir
      setOutput(dir.replace(/\\/g, "/") + "/merged.txt");
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

// ─── Tab: 按章分割 ────────────────────────────────────────────────────────────

function SplitTab() {
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

// ─── Tab: 编码转换（说明页） ───────────────────────────────────────────────────

function EncodingTab() {
  return (
    <Card title="编码转换" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3">
        <div
          className="rounded-xl border px-4 py-4"
          style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
            GBK / Big5 → UTF-8
          </p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            编码转换已内置在下载流程中——下载时设置站点规则的"编码"字段（如{" "}
            <code className="font-mono">gbk</code>）， 下载器会自动将内容转换为 UTF-8 保存。
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
            对于本地已有的 GBK 文件，可以使用"繁→简转换"Tab 中的批量处理功能，
            转换时会自动检测并处理编码。
          </p>
        </div>

        <div
          className="flex items-start gap-2 rounded-xl border px-4 py-3 text-xs"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
        >
          <RefreshCw
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            style={{ color: "var(--color-accent)" }}
          />
          <span>独立的编码转换功能正在规划中，将支持批量将 GBK/Big5 文本文件转换为 UTF-8。</span>
        </div>
      </div>
    </Card>
  );
}

// ─── Shared: ResultsCard ──────────────────────────────────────────────────────

function ResultsCard({ results, running }: { results: ConvertResult[]; running: boolean }) {
  return (
    <Card title="转换结果" className="flex min-h-0 w-80 shrink-0 flex-col">
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {running && results.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2"
              style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-accent)" }}
            />
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              转换中...
            </p>
          </div>
        )}
        {results.map((r, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            {r.ok ? (
              <CheckCircle
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                style={{ color: "var(--color-success)" }}
              />
            ) : (
              <XCircle
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                style={{ color: "var(--color-danger)" }}
              />
            )}
            <div>
              <p
                className="max-w-[220px] truncate font-medium"
                style={{ color: "var(--color-text)" }}
                title={r.path}
              >
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
  );
}

import { useState } from "react";
import { Languages, Merge, RefreshCw, Scissors } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";

import { ConverterTabs } from "./converter/ConverterTabs";
import { EncodingTab } from "./converter/EncodingTab";
import { MergeTab } from "./converter/MergeTab";
import { SplitTab } from "./converter/SplitTab";
import { T2STab } from "./converter/T2STab";
import type { ToolMode } from "./converter/types";

export function ConverterPage() {
  const [mode, setMode] = useState<ToolMode>("t2s");

  const modeCards = [
    {
      id: "t2s" as const,
      label: "繁简转换",
      desc: "批量处理本地 TXT 文件，适合清理旧书源文本。",
      icon: Languages,
    },
    {
      id: "merge" as const,
      label: "合并文件",
      desc: "按顺序拼接多个文件，输出为单一文本。",
      icon: Merge,
    },
    {
      id: "split" as const,
      label: "按章分割",
      desc: "按章节标题自动拆分，快速整理超长文本。",
      icon: Scissors,
    },
    {
      id: "encoding" as const,
      label: "编码说明",
      desc: "查看 GBK / Big5 与 UTF-8 的处理方式。",
      icon: RefreshCw,
    },
  ];

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-5">
      <PageHeader title="文本转换工具" subtitle="繁简转换、文件合并、按章分割与编码处理" />

      <div className="grid shrink-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {modeCards.map(({ id, label, desc, icon: Icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              aria-pressed={active}
              aria-label={`切换到${label}`}
              className="rounded-2xl border px-4 py-3 text-left transition-all"
              style={{
                background: active ? "var(--color-surface)" : "var(--color-surface-1)",
                borderColor: active ? "var(--color-accent)" : "var(--color-border)",
                boxShadow: active ? "var(--shadow-sm)" : "none",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{
                    background: active ? "var(--color-accent-muted)" : "var(--color-surface-2)",
                    color: active ? "var(--color-accent)" : "var(--color-text-muted)",
                  }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  {label}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                {desc}
              </p>
            </button>
          );
        })}
      </div>

      <ConverterTabs mode={mode} onModeChange={setMode} />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden xl:flex-row">
        {mode === "t2s" && <T2STab />}
        {mode === "merge" && <MergeTab />}
        {mode === "split" && <SplitTab />}
        {mode === "encoding" && <EncodingTab />}
      </div>
    </div>
  );
}

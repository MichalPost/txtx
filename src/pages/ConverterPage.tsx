import { useState } from "react";

import { PageHeader } from "@/components/PageHeader";

import { ConverterTabs } from "./converter/ConverterTabs";
import { EncodingTab } from "./converter/EncodingTab";
import { MergeTab } from "./converter/MergeTab";
import { SplitTab } from "./converter/SplitTab";
import { T2STab } from "./converter/T2STab";
import type { ToolMode } from "./converter/types";

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ConverterPage() {
  const [mode, setMode] = useState<ToolMode>("t2s");

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-5">
      <PageHeader title="文本工具箱" subtitle="繁简转换、文件合并、章节分割" />

      <ConverterTabs mode={mode} onModeChange={setMode} />

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        {mode === "t2s" && <T2STab />}
        {mode === "merge" && <MergeTab />}
        {mode === "split" && <SplitTab />}
        {mode === "encoding" && <EncodingTab />}
      </div>
    </div>
  );
}

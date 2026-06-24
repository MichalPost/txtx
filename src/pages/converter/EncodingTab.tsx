import { RefreshCw } from "lucide-react";

import { Card } from "@/components/Card";

export function EncodingTab() {
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
            对于本地已有的 TXT 文件，现在也可以直接使用"繁→简转换"Tab：
            它会自动识别 UTF-8、GBK、Big5，并在输出结果里提示识别到的输入编码。
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
          <span>
            独立编码转换页仍在规划中；当前已经优先补齐 TXT 本地文件的自动识别与 UTF-8 写回主流程。
          </span>
        </div>
      </div>
    </Card>
  );
}

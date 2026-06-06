import { Info } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { Card } from "@/components/Card";

import type { SettingsForm } from "../settingsSchema";

/**
 * EncodingMapSection — 只读展示当前编码映射
 *
 * 编码配置现在改为在「规则管理」中按站点维护。
 * 这里仅展示目前生效的映射，方便排查问题。
 */
export function EncodingMapSection() {
  const { watch } = useFormContext<SettingsForm>();
  const fields = watch("encoding_map");

  return (
    <Card title="编码映射">
      <div className="flex flex-col gap-3">
        {/* 说明 */}
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs"
          style={{
            background: "var(--color-accent-muted)",
            border: "1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)",
            color: "var(--color-text-muted)",
          }}
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
          <span>
            编码现在在<strong style={{ color: "var(--color-text)" }}>规则管理</strong>
            里按站点单独配置， 保存规则时会自动同步到这里。如需临时手动调整，可直接编辑
            <code
              className="mx-1 rounded px-1"
              style={{
                background: "var(--color-surface-2)",
                fontFamily: "monospace",
                fontSize: "11px",
              }}
            >
              config.yml
            </code>
            中的{" "}
            <code
              className="rounded px-1"
              style={{
                background: "var(--color-surface-2)",
                fontFamily: "monospace",
                fontSize: "11px",
              }}
            >
              network.encoding_map
            </code>{" "}
            字段。
          </span>
        </div>

        {/* 只读列表 */}
        {fields && fields.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {fields.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <span
                  className="flex-1 truncate font-mono text-xs"
                  style={{ color: "var(--color-text)" }}
                >
                  {f.domain || "—"}
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 font-mono text-xs"
                  style={{
                    background: "var(--color-accent-muted)",
                    color: "var(--color-accent)",
                    border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
                  }}
                >
                  {f.encoding || "—"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            暂无编码映射规则，所有站点使用 UTF-8 / HTTP 响应头声明的编码。
          </p>
        )}
      </div>
    </Card>
  );
}

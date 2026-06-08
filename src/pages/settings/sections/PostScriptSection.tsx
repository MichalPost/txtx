/**
 * PostScriptSection — 下载完成后执行自定义 shell 命令
 * %DIR% 占位符会被替换为实际下载目录
 */
import { Terminal } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { Card } from "@/components/Card";
import { Input } from "@/components/Input";

import type { SettingsForm } from "../settingsSchema";

export function PostScriptSection() {
  const { register, watch } = useFormContext<SettingsForm>();
  const enabled = watch("post_process_enabled");

  return (
    <Card title="后处理脚本">
      <div className="flex flex-col gap-3">
        <label
          className="flex cursor-pointer items-center gap-2 text-xs"
          style={{ color: "var(--color-text)" }}
        >
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[var(--color-accent)]"
            {...register("post_process_enabled")}
          />
          <span>下载完成后执行脚本</span>
        </label>

        {enabled && (
          <>
            <Input
              label="命令（%DIR% 会被替换为下载目录）"
              placeholder='xcopy "%DIR%" "\\NAS\books\" /E /Y'
              {...register("post_process_script")}
            />
            <label
              className="flex cursor-pointer items-center gap-2 text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                {...register("post_process_batch_done")}
              />
              <span>整批下载完成后执行一次（不勾选则每本书完成后各执行一次）</span>
            </label>

            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
              style={{
                background: "var(--color-surface-2)",
                color: "var(--color-text-muted)",
              }}
            >
              <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                命令在 <code className="font-mono">cmd.exe /C</code>{" "}
                中执行，可以是批处理命令或外部程序。 示例：
                <code className="ml-1 font-mono">
                  robocopy &quot;%DIR%&quot; &quot;D:\备份&quot; *.txt /MIR
                </code>
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

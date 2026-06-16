import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";
import { toast } from "sonner";

import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { apiDetectCalibre } from "@/lib/api";
import { formatToolActionError } from "@/lib/toolActionError";

import type { SettingsForm } from "../settingsSchema";

const EBOOK_FORMATS = ["epub", "mobi", "azw3"];

export function EbookSection() {
  const { register, control, setValue } = useFormContext<SettingsForm>();
  const [detecting, setDetecting] = useState(false);

  const handleDetectCalibre = async () => {
    setDetecting(true);
    try {
      const path = await apiDetectCalibre();
      if (path) {
        setValue("eb_calibre", path, { shouldDirty: true });
        toast.success(`已检测到 Calibre: ${path}`);
      } else {
        toast.error("未找到 Calibre 安装路径，请手动填写");
      }
    } catch (error) {
      toast.error(formatToolActionError("检测 Calibre", error));
    } finally {
      setDetecting(false);
    }
  };

  return (
    <Card title="电子书转换">
      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer items-center gap-3">
          <Controller
            control={control}
            name="eb_enabled"
            render={({ field }) => (
              <input
                type="checkbox"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                style={{ accentColor: "var(--color-accent)" }}
              />
            )}
          />
          <span className="text-sm" style={{ color: "var(--color-text)" }}>
            下载完成后自动转换
          </span>
        </label>

        <div>
          <p className="mb-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
            输出格式
          </p>
          <div className="flex gap-4">
            {EBOOK_FORMATS.map((fmt) => (
              <Controller
                key={fmt}
                control={control}
                name="eb_formats"
                render={({ field }) => (
                  <label
                    className="flex cursor-pointer items-center gap-2 text-sm"
                    style={{ color: "var(--color-text)" }}
                  >
                    <input
                      type="checkbox"
                      checked={field.value.includes(fmt)}
                      onChange={(e) => {
                        field.onChange(
                          e.target.checked
                            ? [...field.value, fmt]
                            : field.value.filter((f: string) => f !== fmt),
                        );
                      }}
                      style={{ accentColor: "var(--color-accent)" }}
                    />
                    {fmt.toUpperCase()}
                  </label>
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Calibre 路径（留空自动检测，MOBI/AZW3 需要）"
              placeholder="C:\Program Files\Calibre2\ebook-convert.exe"
              {...register("eb_calibre")}
            />
          </div>
          <button
            type="button"
            onClick={handleDetectCalibre}
            disabled={detecting}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
              background: "var(--color-surface-2)",
              marginBottom: "1px",
            }}
          >
            {detecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            自动检测
          </button>
        </div>
      </div>
    </Card>
  );
}

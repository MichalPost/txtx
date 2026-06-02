import { useFormContext, Controller } from "react-hook-form";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import type { SettingsForm } from "../settingsSchema";

const EBOOK_FORMATS = ["epub", "mobi", "azw3"];

export function EbookSection() {
  const { register, control } = useFormContext<SettingsForm>();

  return (
    <Card title="电子书转换">
      <div className="flex flex-col gap-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <Controller
            control={control}
            name="eb_enabled"
            render={({ field }) => (
              <input
                type="checkbox"
                checked={field.value}
                onChange={e => field.onChange(e.target.checked)}
                style={{ accentColor: "var(--color-accent)" }}
              />
            )}
          />
          <span className="text-sm" style={{ color: "var(--color-text)" }}>下载完成后自动转换</span>
        </label>

        <div>
          <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>输出格式</p>
          <div className="flex gap-4">
            {EBOOK_FORMATS.map(fmt => (
              <Controller
                key={fmt}
                control={control}
                name="eb_formats"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--color-text)" }}>
                    <input
                      type="checkbox"
                      checked={field.value.includes(fmt)}
                      onChange={e => {
                        field.onChange(
                          e.target.checked
                            ? [...field.value, fmt]
                            : field.value.filter((f: string) => f !== fmt)
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

        <Input
          label="Calibre 路径（留空自动检测，MOBI/AZW3 需要）"
          placeholder="C:\Program Files\Calibre2\ebook-convert.exe"
          {...register("eb_calibre")}
        />
      </div>
    </Card>
  );
}

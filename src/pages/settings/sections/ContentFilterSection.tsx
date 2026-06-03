import { useFormContext } from "react-hook-form";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { FieldError, FormTextarea } from "../SettingsFields";
import type { SettingsForm } from "../settingsSchema";

export function ContentFilterSection() {
  const { register, formState: { errors } } = useFormContext<SettingsForm>();

  return (
    <Card title="内容过滤">
      <div className="flex flex-col gap-4">
        <FormTextarea rows={6} label="广告过滤正则（每行一条，命中即删除）" field="ad_patterns" />
        <FormTextarea rows={4} label="末尾导航行关键词（每行一条，从末尾循环剥离）" field="nav_keywords" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input label="安全回退阈值（0.0~1.0）" type="number" step={0.05} {...register("safety_threshold")} />
            <FieldError msg={errors.safety_threshold?.message} />
          </div>
          <div>
            <Input label="回退时末尾删除行数" type="number" {...register("fallback_trim_lines")} />
            <FieldError msg={errors.fallback_trim_lines?.message} />
          </div>
        </div>
      </div>
    </Card>
  );
}

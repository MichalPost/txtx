import { useFormContext } from "react-hook-form";

import { Card } from "@/components/Card";
import { Input } from "@/components/Input";

import { FieldError } from "../SettingsFields";
import type { SettingsForm } from "../settingsSchema";

export function FilterSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<SettingsForm>();

  return (
    <Card title="过滤配置">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input label="最大天数限制" type="number" {...register("days_limit")} />
          <FieldError msg={errors.days_limit?.message} />
        </div>
        <div>
          <Input label="最小天数限制" type="number" {...register("min_days_limit")} />
          <FieldError msg={errors.min_days_limit?.message} />
        </div>
        <div className="col-span-2">
          <Input
            label="上次下载日期（YYYY-MM-DD，留空则按最大天数）"
            placeholder="2026-01-01"
            {...register("last_download_date")}
          />
          <FieldError msg={errors.last_download_date?.message} />
        </div>
      </div>
    </Card>
  );
}

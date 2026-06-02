import { useFormContext } from "react-hook-form";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { FieldError, FormTextarea } from "../SettingsFields";
import type { SettingsForm } from "../settingsSchema";

export function TtksSection() {
  const { register, formState: { errors } } = useFormContext<SettingsForm>();

  return (
    <Card title="TTKS 专用配置">
      <div className="flex flex-col gap-4">
        <FormTextarea rows={3} label="TTKS 域名特征（每行一条）" field="ttks_domains" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input label="最小延迟（毫秒）" type="number" {...register("ttks_delay_min")} />
            <FieldError msg={errors.ttks_delay_min?.message} />
          </div>
          <div>
            <Input label="最大延迟（毫秒）" type="number" {...register("ttks_delay_max")} />
            <FieldError msg={errors.ttks_delay_max?.message} />
          </div>
        </div>
        <FormTextarea rows={5} label="User-Agent 池（每行一条，随机轮换）" field="ttks_ua_pool" />
      </div>
    </Card>
  );
}

import { useFormContext } from "react-hook-form";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { FieldError } from "../SettingsFields";
import type { SettingsForm } from "../settingsSchema";

export function NetworkSection() {
  const { register, formState: { errors } } = useFormContext<SettingsForm>();

  return (
    <Card title="网络配置">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input label="User-Agent" {...register("user_agent")} />
          <FieldError msg={errors.user_agent?.message} />
        </div>
        <div>
          <Input label="代理地址（留空不使用）" placeholder="http://127.0.0.1:7890" {...register("proxy")} />
          <FieldError msg={errors.proxy?.message} />
        </div>
        <div>
          <Input label="超时（秒）" type="number" {...register("timeout")} />
          <FieldError msg={errors.timeout?.message} />
        </div>
        <div>
          <Input label="重试次数" type="number" {...register("retry_count")} />
          <FieldError msg={errors.retry_count?.message} />
        </div>
        <div>
          <Input label="重试间隔（秒）" type="number" {...register("retry_delay")} />
          <FieldError msg={errors.retry_delay?.message} />
        </div>
      </div>
    </Card>
  );
}

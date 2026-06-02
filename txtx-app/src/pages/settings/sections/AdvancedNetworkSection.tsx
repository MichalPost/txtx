import { useFormContext } from "react-hook-form";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { FieldError } from "../SettingsFields";
import type { SettingsForm } from "../settingsSchema";

export function AdvancedNetworkSection() {
  const { register, formState: { errors } } = useFormContext<SettingsForm>();

  return (
    <Card title="高级网络参数">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input label="连接池空闲超时（秒）" type="number" {...register("pool_idle_timeout_secs")} />
          <FieldError msg={errors.pool_idle_timeout_secs?.message} />
        </div>
        <div>
          <Input label="TCP Keepalive（秒）" type="number" {...register("tcp_keepalive_secs")} />
          <FieldError msg={errors.tcp_keepalive_secs?.message} />
        </div>
        <div>
          <Input label="小文件阈值（字节）" type="number" {...register("min_chapter_bytes")} />
          <FieldError msg={errors.min_chapter_bytes?.message} />
        </div>
        <div>
          <Input label="章节失败率阈值（0.0~1.0）" type="number" step={0.01} {...register("chapter_fail_threshold")} />
          <FieldError msg={errors.chapter_fail_threshold?.message} />
        </div>
      </div>
    </Card>
  );
}

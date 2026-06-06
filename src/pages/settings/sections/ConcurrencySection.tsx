import { useFormContext } from "react-hook-form";

import { Card } from "@/components/Card";
import { Input } from "@/components/Input";

import { FieldError } from "../SettingsFields";
import type { SettingsForm } from "../settingsSchema";

export function ConcurrencySection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<SettingsForm>();

  return (
    <Card title="并发配置">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input label="小说并发数" type="number" {...register("novel_threads")} />
          <FieldError msg={errors.novel_threads?.message} />
        </div>
        <div>
          <Input label="章节并发数" type="number" {...register("chapter_threads")} />
          <FieldError msg={errors.chapter_threads?.message} />
        </div>
        <div>
          <Input label="每主机最大连接数" type="number" {...register("max_connections_per_host")} />
          <FieldError msg={errors.max_connections_per_host?.message} />
        </div>
        <div>
          <Input label="连接池大小" type="number" {...register("connection_pool_size")} />
          <FieldError msg={errors.connection_pool_size?.message} />
        </div>
      </div>
    </Card>
  );
}

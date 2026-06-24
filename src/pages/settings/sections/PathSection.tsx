import { FolderOpen } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { apiPickDirectory } from "@/lib/api";
import { formatToolActionError } from "@/lib/toolActionError";

import { FieldError } from "../SettingsFields";
import type { SettingsForm } from "../settingsSchema";

export function PathSection() {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<SettingsForm>();

  const pickDir = async (field: "base_dir" | "temp_dir" | "log_dir") => {
    try {
      const selected = await apiPickDirectory();
      if (selected) setValue(field, selected, { shouldDirty: true });
    } catch (error) {
      toast.error(formatToolActionError("选择目录", error));
    }
  };

  return (
    <Card title="路径配置">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input label="下载目录" {...register("base_dir")} />
            <FieldError msg={errors.base_dir?.message} />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => pickDir("base_dir")}
            className="justify-center sm:self-auto"
            aria-label="选择下载目录"
            title="选择下载目录"
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input label="临时目录" {...register("temp_dir")} />
            <FieldError msg={errors.temp_dir?.message} />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => pickDir("temp_dir")}
            className="justify-center sm:self-auto"
            aria-label="选择临时目录"
            title="选择临时目录"
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input label="日志目录" {...register("log_dir")} />
            <FieldError msg={errors.log_dir?.message} />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => pickDir("log_dir")}
            className="justify-center sm:self-auto"
            aria-label="选择日志目录"
            title="选择日志目录"
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

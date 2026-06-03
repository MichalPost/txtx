import { useFormContext } from "react-hook-form";
import { FolderOpen } from "lucide-react";
import { apiPickDirectory } from "@/lib/api";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { FieldError } from "../SettingsFields";
import type { SettingsForm } from "../settingsSchema";

export function PathSection() {
  const { register, setValue, formState: { errors } } = useFormContext<SettingsForm>();

  const pickDir = async () => {
    const selected = await apiPickDirectory();
    if (selected) setValue("base_dir", selected, { shouldDirty: true });
  };

  return (
    <Card title="路径配置">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input label="下载目录" {...register("base_dir")} />
          <FieldError msg={errors.base_dir?.message} />
        </div>
        <Button type="button" variant="secondary" size="md" onClick={pickDir}>
          <FolderOpen className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}

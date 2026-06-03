import { useFormContext, useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import type { SettingsForm } from "../settingsSchema";

export function EncodingMapSection() {
  const { register, control } = useFormContext<SettingsForm>();
  const { fields, append, remove } = useFieldArray({ control, name: "encoding_map" });

  return (
    <Card title="编码映射">
      <div className="flex flex-col gap-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2 items-center">
            <Input className="flex-1" placeholder="域名" {...register(`encoding_map.${index}.domain`)} />
            <Input className="w-24" placeholder="gbk/utf-8" {...register(`encoding_map.${index}.encoding`)} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(index)}
              style={{ color: "var(--color-danger)" }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start mt-1"
          onClick={() => append({ domain: "", encoding: "gbk" })}
        >
          <Plus className="w-3.5 h-3.5" /> 添加编码规则
        </Button>
      </div>
    </Card>
  );
}

import { Controller, useFormContext } from "react-hook-form";

import { Card } from "@/components/Card";

import type { SettingsForm } from "../settingsSchema";

const TC_FIELDS: [keyof SettingsForm, string][] = [
  ["tc_enabled", "启用繁简转换"],
  ["tc_t2s", "繁体 → 简体"],
  ["tc_auto", "自动检测（仅含繁体字时才转换）"],
];

export function TextConversionSection() {
  const { control } = useFormContext<SettingsForm>();

  return (
    <Card title="繁简转换">
      <div className="flex flex-col gap-3">
        {TC_FIELDS.map(([name, label]) => (
          <label key={name} className="flex cursor-pointer items-center gap-3">
            <Controller
              control={control}
              name={name}
              render={({ field }) => (
                <input
                  type="checkbox"
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  style={{ accentColor: "var(--color-accent)" }}
                />
              )}
            />
            <span className="text-sm" style={{ color: "var(--color-text)" }}>
              {label}
            </span>
          </label>
        ))}
      </div>
    </Card>
  );
}

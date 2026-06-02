/**
 * 共用字段组件：FieldError、FormTextarea
 * 供各 Section 组件使用，避免重复代码
 */
import { useFormContext } from "react-hook-form";
import type { SettingsForm } from "./settingsSchema";

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <span className="text-xs mt-0.5" style={{ color: "var(--color-danger)" }}>{msg}</span>;
}

interface FormTextareaProps {
  rows: number;
  label: string;
  field: keyof SettingsForm;
}

export function FormTextarea({ rows, label, field }: FormTextareaProps) {
  const { register, formState: { errors } } = useFormContext<SettingsForm>();
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{label}</label>
      <textarea
        {...register(field as never)}
        rows={rows}
        className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none resize-y"
        style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        onFocus={e => { e.currentTarget.style.borderColor = "var(--color-accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.boxShadow = "none"; }}
      />
      <FieldError msg={(errors[field] as { message?: string })?.message} />
    </div>
  );
}

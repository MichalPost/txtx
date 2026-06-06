import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import {
  useAiStore,
  AI_PROVIDER_PRESETS,
  AI_PROVIDER_PRESET_LABELS,
  type AiProviderEntry,
  type AiProviderPresetKey,
} from "@/store/aiStore";
import { Field, ApiKeyInput, ModelSelect } from "./AiFormFields";

export function AddProviderForm({ allNames }: { allNames: string[] }) {
  const { addProvider } = useAiStore();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<AiProviderPresetKey>("openai");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [form, setForm] = useState<Omit<AiProviderEntry, "name">>({
    base_url: AI_PROVIDER_PRESETS.openai.base_url,
    api_key: "",
    model: AI_PROVIDER_PRESETS.openai.model,
    available_models: AI_PROVIDER_PRESETS.openai.available_models,
    max_tokens: 2048,
    temperature: 0.2,
  });
  const set = <K extends keyof Omit<AiProviderEntry, "name">>(k: K) =>
    (v: Omit<AiProviderEntry, "name">[K]) =>
      setForm((f) => ({ ...f, [k]: v }));

  const handlePresetChange = (key: AiProviderPresetKey) => {
    setPreset(key);
    const p = AI_PROVIDER_PRESETS[key];
    setForm((f) => ({ ...f, base_url: p.base_url, model: p.model, available_models: p.available_models }));
    if (!name) setName(key);
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setNameError("请输入供应商名称"); return; }
    if (allNames.includes(trimmed)) { setNameError("名称已存在"); return; }
    addProvider({ name: trimmed, ...form });
    // reset
    setOpen(false);
    setName("");
    setNameError("");
    setPreset("openai");
    setForm({
      base_url: AI_PROVIDER_PRESETS.openai.base_url,
      api_key: "",
      model: AI_PROVIDER_PRESETS.openai.model,
      available_models: AI_PROVIDER_PRESETS.openai.available_models,
      max_tokens: 2048,
      temperature: 0.2,
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 w-full rounded-[12px] border-2 border-dashed py-3 text-sm transition-colors hover:opacity-70"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text-subtle)" }}
      >
        <Plus className="w-4 h-4" />
        添加供应商
      </button>
    );
  }

  return (
    <div
      className="rounded-[12px] border overflow-hidden"
      style={{ borderColor: "var(--color-accent)", background: "var(--color-surface)" }}
    >
      <div
        className="px-4 py-2.5 border-b flex items-center justify-between"
        style={{ borderColor: "var(--color-border)" }}
      >
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          添加供应商
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs hover:opacity-70"
          style={{ color: "var(--color-text-subtle)" }}
        >
          取消
        </button>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3" style={{ background: "var(--color-surface-2)" }}>
        {/* Quick preset */}
        <Field label="快速预设">
          <select
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value as AiProviderPresetKey)}
            className="w-full border rounded-[10px] px-3 py-2 text-sm focus:outline-none"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            {(Object.keys(AI_PROVIDER_PRESET_LABELS) as AiProviderPresetKey[]).map((k) => (
              <option key={k} value={k}>{AI_PROVIDER_PRESET_LABELS[k]}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input
              label="供应商名称"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(""); }}
              placeholder="如：deepseek-2"
              error={nameError}
            />
          </div>
          <div className="col-span-2">
            <Field label="API Key" hint="仅存本地">
              <ApiKeyInput value={form.api_key} onChange={set("api_key")} />
            </Field>
          </div>
          <div className="col-span-2">
            <Input
              label="Base URL"
              value={form.base_url}
              onChange={(e) => set("base_url")(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div>
            <Field label="当前模型">
              <ModelSelect
                value={form.model}
                onChange={set("model")}
                options={form.available_models}
              />
            </Field>
          </div>
          <div>
            <Input
              label="最大 Token 数"
              type="number"
              value={String(form.max_tokens)}
              onChange={(e) => set("max_tokens")(parseInt(e.target.value, 10) || 2048)}
            />
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={submit}>
          <Plus className="w-3.5 h-3.5" />
          添加
        </Button>
      </div>
    </div>
  );
}

import { useState } from "react";
import {
  ChevronDown, Loader2, Copy, Activity, CheckCircle2, Trash2,
} from "lucide-react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import {
  useAiStore,
  type AiProviderEntry,
} from "@/store/aiStore";
import { Field, ApiKeyInput, ModelSelect, ModelListEditor, TestResult } from "./AiFormFields";

export function ProviderCard({
  entry,
  isActive,
  allNames,
}: {
  entry: AiProviderEntry;
  isActive: boolean;
  allNames: string[];
}) {
  const { updateProvider, removeProvider, setActiveProvider, addProvider, testProvider } = useAiStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...entry });
  const set = <K extends keyof AiProviderEntry>(k: K) => (v: AiProviderEntry[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  const hasChanges =
    form.base_url !== entry.base_url ||
    form.api_key !== entry.api_key ||
    form.model !== entry.model ||
    form.max_tokens !== entry.max_tokens ||
    form.temperature !== entry.temperature ||
    JSON.stringify(form.available_models) !== JSON.stringify(entry.available_models);

  const save = () => {
    updateProvider(entry.name, {
      base_url: form.base_url,
      api_key: form.api_key,
      model: form.model,
      available_models: form.available_models,
      max_tokens: form.max_tokens,
      temperature: form.temperature,
    });
  };

  const test = async () => {
    // save first so test uses current form values
    save();
    setTestStatus("testing");
    setTestMsg("");
    // Wait a tick for store to update
    await new Promise((r) => setTimeout(r, 50));
    const result = await testProvider(entry.name);
    setTestStatus(result.ok ? "ok" : "error");
    setTestMsg(result.message);
  };

  const genCopyName = () => {
    let i = 2;
    while (allNames.includes(`${entry.name}-${i}`)) i++;
    return `${entry.name}-${i}`;
  };

  const copyProvider = () => {
    const copyName = genCopyName();
    addProvider({
      ...form,
      name: copyName,
      api_key: "",
    });
  };

  return (
    <div
      className="rounded-[12px] border overflow-hidden"
      style={{
        borderColor: isActive
          ? "color-mix(in srgb, var(--color-accent) 50%, var(--color-border))"
          : "var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      {/* Header row */}
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:opacity-90"
        style={{ background: "var(--color-surface)" }}
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {entry.name}
          </span>
          {/* Model badge */}
          <span
            className="text-xs rounded-md px-2 py-0.5 border"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            {entry.model || "未设置"}
          </span>
          {isActive && (
            <span
              className="text-xs rounded-md px-2 py-0.5 font-medium"
              style={{
                background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                color: "var(--color-accent)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)",
              }}
            >
              当前
            </span>
          )}
        </div>
        <span
          className="shrink-0 transition-transform duration-200 inline-flex"
          style={{
            color: "var(--color-text-subtle)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <ChevronDown className="w-4 h-4" />
        </span>
      </button>

      {/* Expanded body */}
      {open && (
        <div
          className="border-t px-4 pb-4 pt-4 flex flex-col gap-3"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
        >
          <div className="grid grid-cols-2 gap-3">
            {/* API Key */}
            <div className="col-span-2">
              <Field label="API Key" hint="仅存本地，不写入配置文件">
                <ApiKeyInput
                  value={form.api_key}
                  onChange={set("api_key")}
                  placeholder={entry.name === "ollama" ? "Ollama 无需 Key" : "sk-..."}
                />
              </Field>
            </div>

            {/* Base URL */}
            <div className="col-span-2">
              <Field label="Base URL">
                <Input
                  value={form.base_url}
                  onChange={(e) => set("base_url")(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </Field>
            </div>

            {/* Model select */}
            <div>
              <Field label="当前模型">
                <ModelSelect
                  value={form.model}
                  onChange={set("model")}
                  options={form.available_models}
                />
              </Field>
            </div>

            {/* Max tokens */}
            <div>
              <Field label="最大 Token 数">
                <Input
                  type="number"
                  value={String(form.max_tokens)}
                  onChange={(e) =>
                    set("max_tokens")(parseInt(e.target.value, 10) || 2048)
                  }
                />
              </Field>
            </div>

            {/* Temperature */}
            <div>
              <Field label="温度" hint="0~2">
                <Input
                  type="number"
                  value={String(form.temperature)}
                  onChange={(e) =>
                    set("temperature")(parseFloat(e.target.value) || 0.2)
                  }
                  placeholder="0.2"
                />
              </Field>
            </div>

            {/* Available models list */}
            <div className="col-span-2">
              <Field label="可用模型列表" hint="添加后可在上方下拉选择">
                <ModelListEditor
                  value={form.available_models}
                  onChange={set("available_models")}
                />
              </Field>
            </div>
          </div>

          {/* Test result */}
          {(testStatus === "ok" || testStatus === "error") && (
            <TestResult ok={testStatus === "ok"} message={testMsg} />
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={save}
              disabled={!hasChanges}
            >
              保存
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={test}
              disabled={testStatus === "testing"}
            >
              {testStatus === "testing"
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Activity className="w-3.5 h-3.5" />}
              {testStatus === "testing" ? "测试中..." : "测试连接"}
            </Button>
            {!isActive && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveProvider(entry.name)}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                设为当前
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={copyProvider}
            >
              <Copy className="w-3.5 h-3.5" />
              复制
            </Button>
            {!isActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`确认删除供应商 "${entry.name}"？`)) {
                    removeProvider(entry.name);
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                删除
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import {
  Sparkles, ChevronDown, Eye, EyeOff, Plus, Trash2,
  CheckCircle2, XCircle, Loader2, Copy, Activity,
} from "lucide-react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Toggle } from "@/components/Toggle";
import { Input } from "@/components/Input";
import {
  useAiStore,
  AI_PROVIDER_PRESETS,
  AI_PROVIDER_PRESET_LABELS,
  type AiProviderEntry,
  type AiProviderPresetKey,
} from "@/store/aiStore";

// ─── Field wrapper ──────────────────────────────────────────────────────────────

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
        {label}
        {hint && (
          <span className="ml-1.5 font-normal" style={{ color: "var(--color-text-subtle)" }}>
            ({hint})
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

// ─── ApiKeyInput ────────────────────────────────────────────────────────────────

function ApiKeyInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const base = {
    background: "var(--color-surface)",
    borderColor: "var(--color-border)",
    color: "var(--color-text)",
  } as const;
  return (
    <div className="flex gap-1.5">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "sk-..."}
        className="flex-1 border rounded-[10px] px-3 py-2 text-sm focus:outline-none"
        style={base}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--color-accent)";
          e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--color-border)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="px-2.5 border rounded-[10px] transition-colors hover:opacity-70"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text-subtle)", background: "var(--color-surface)" }}
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ─── ModelSelect ────────────────────────────────────────────────────────────────

function ModelSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  if (options.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="输入模型名称"
      />
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border rounded-[10px] px-3 py-2 text-sm focus:outline-none"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        color: "var(--color-text)",
      }}
    >
      {!options.includes(value) && value && (
        <option value={value}>{value}（自定义）</option>
      )}
      {options.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  );
}

// ─── ModelListEditor ────────────────────────────────────────────────────────────

function ModelListEditor({ value, onChange }: {
  value: string[]; onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const tokens = input
      .split(/[\n\r\s]+/)
      .map((t) => t.trim())
      .filter((t) => t && !value.includes(t));
    if (tokens.length === 0) return;
    onChange([...value, ...tokens]);
    setInput("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {value.length === 0 && (
          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            暂无，添加后可在模型字段下拉选择
          </span>
        )}
        {value.map((m) => (
          <span
            key={m}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs border"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            {m}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== m))}
              className="opacity-50 hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              add();
            }
          }}
          placeholder={"输入模型名称，回车添加\n支持换行或空格批量粘贴"}
          rows={2}
          className="flex-1 border rounded-[10px] px-3 py-1.5 text-xs resize-none focus:outline-none"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-accent)";
            e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!input.trim()}
          className="px-2.5 border rounded-[10px] text-xs transition-colors hover:opacity-70 disabled:opacity-40"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)", background: "var(--color-surface)" }}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── TestResult ─────────────────────────────────────────────────────────────────

function TestResult({ ok, message }: { ok: boolean; message: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-xs"
      style={{
        background: ok
          ? "color-mix(in srgb, var(--color-success, #22c55e) 8%, var(--color-surface))"
          : "color-mix(in srgb, var(--color-danger) 8%, var(--color-surface))",
        border: `1px solid ${ok
          ? "color-mix(in srgb, var(--color-success, #22c55e) 25%, var(--color-border))"
          : "color-mix(in srgb, var(--color-danger) 25%, var(--color-border))"}`,
        color: ok ? "var(--color-success, #22c55e)" : "var(--color-danger)",
      }}
    >
      {ok
        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        : <XCircle className="w-3.5 h-3.5 shrink-0" />}
      {message}
    </div>
  );
}

// ─── ProviderCard ───────────────────────────────────────────────────────────────

function ProviderCard({
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

// ─── AddProviderForm ────────────────────────────────────────────────────────────

function AddProviderForm({ allNames }: { allNames: string[] }) {
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

// ─── AiSection (main) ───────────────────────────────────────────────────────────

export function AiSection() {
  const { config, loaded, load, setEnabled } = useAiStore();

  useEffect(() => { if (!loaded) load(); }, [loaded, load]);

  const providers = config.providers;
  const active = config.active_provider;
  const allNames = providers.map((p) => p.name);

  return (
    <Card
      title="AI 助手"
      actions={
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {config.enabled ? "已启用" : "已关闭"}
          </span>
          <Toggle
            checked={config.enabled}
            onChange={setEnabled}
          />
        </div>
      }
    >
      {!config.enabled ? (
        <div className="flex items-center gap-3 py-2">
          <Sparkles className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-subtle)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            启用 AI 助手后，可在源码查看器和网站配置中使用智能 XPath 生成功能。
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Active provider summary */}
          {providers.length > 1 && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-xs"
              style={{
                background: "color-mix(in srgb, var(--color-accent) 6%, var(--color-surface-2))",
                border: "1px solid color-mix(in srgb, var(--color-accent) 15%, var(--color-border))",
                color: "var(--color-text-muted)",
              }}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
              当前活跃：
              <span className="font-medium" style={{ color: "var(--color-accent)" }}>
                {active}
              </span>
              <span style={{ color: "var(--color-text-subtle)" }}>
                — 共 {providers.length} 个供应商
              </span>
            </div>
          )}

          {/* Provider cards */}
          {providers.map((p) => (
            <ProviderCard
              key={p.name}
              entry={p}
              isActive={p.name === active}
              allNames={allNames}
            />
          ))}

          {/* Add provider */}
          <AddProviderForm allNames={allNames} />
        </div>
      )}
    </Card>
  );
}

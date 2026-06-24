import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, ChevronDown, Copy, Loader2, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/Button";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/Input";
import { useAiStore, type AiProviderEntry } from "@/store/aiStore";

import { ApiKeyInput, Field, ModelListEditor, ModelSelect, TestResult } from "./AiFormFields";
import {
  buildProviderSnapshot,
  getProviderDraftSyncState,
  isProviderDraftDirty,
  parseProviderPositiveIntegerDraft,
  parseProviderTemperatureDraft,
} from "./providerCardUtils";

export function ProviderCard({
  entry,
  isActive,
  allNames,
}: {
  entry: AiProviderEntry;
  isActive: boolean;
  allNames: string[];
}) {
  const { updateProvider, removeProvider, setActiveProvider, addProvider, testProvider } =
    useAiStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...entry });
  const [baseline, setBaseline] = useState({ ...entry });
  const [deletePending, setDeletePending] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const entrySnapshot = useMemo(() => buildProviderSnapshot(entry), [entry]);
  const set =
    <K extends keyof AiProviderEntry>(k: K) =>
    (v: AiProviderEntry[K]) =>
      setForm((f) => ({ ...f, [k]: v }));

  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  const [nameError, setNameError] = useState("");
  const fieldPrefix = `ai-provider-${entry.name.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;

  const syncState = getProviderDraftSyncState({ form, baseline, entry });
  const hasChanges = isProviderDraftDirty(form, baseline);

  useEffect(() => {
    const nextEntry = { ...entry };
    setBaseline((currentBaseline) => {
      const externalChanged = buildProviderSnapshot(currentBaseline) !== entrySnapshot;
      if (!externalChanged) return currentBaseline;
      setForm((currentForm) =>
        isProviderDraftDirty(currentForm, currentBaseline) ? currentForm : nextEntry,
      );
      return nextEntry;
    });
  }, [entry, entrySnapshot]);

  const save = (): { ok: true; name: string } | { ok: false } => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setNameError("名称不能为空");
      return { ok: false };
    }
    if (trimmedName !== entry.name && allNames.includes(trimmedName)) {
      setNameError("名称已存在");
      return { ok: false };
    }
    setNameError("");
    updateProvider(entry.name, {
      name: trimmedName,
      base_url: form.base_url,
      api_key: form.api_key,
      model: form.model,
      available_models: form.available_models,
      max_tokens: form.max_tokens,
      temperature: form.temperature,
    });
    setBaseline({ ...form, name: trimmedName });
    setForm((current) => ({ ...current, name: trimmedName }));
    return { ok: true, name: trimmedName };
  };

  const test = async () => {
    // save first so test uses current form values
    const saveResult = save();
    if (!saveResult.ok) return;
    setTestStatus("testing");
    setTestMsg("");
    // Wait a tick for store to update
    await new Promise((r) => setTimeout(r, 50));
    const result = await testProvider(saveResult.name);
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

  const syncLatestProvider = () => {
    setForm({ ...entry });
    setBaseline({ ...entry });
    setNameError("");
    setTestStatus("idle");
    setTestMsg("");
  };

  const deleteProvider = async () => {
    if (isActive || deletePending) return;
    setDeletePending(true);
    const confirmed = await confirm({
      title: `删除供应商「${entry.name}」？`,
      description: "删除后该供应商的 Base URL、模型列表和 API Key 配置都会从本地配置中移除。",
      confirmLabel: "删除供应商",
      tone: "danger",
    }).catch(() => false);
    setDeletePending(false);
    if (!confirmed) return;
    const latestConfig = useAiStore.getState().config;
    const stillExists = latestConfig.providers.some((provider) => provider.name === entry.name);
    if (!stillExists) return;
    if (latestConfig.active_provider === entry.name) return;
    removeProvider(entry.name);
  };

  return (
    <div
      className="overflow-hidden rounded-[12px] border"
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
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {entry.name}
          </span>
          {/* Model badge */}
          <span
            className="rounded-md border px-2 py-0.5 text-xs"
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
              className="rounded-md px-2 py-0.5 text-xs font-medium"
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
          className="inline-flex shrink-0 transition-transform duration-200"
          style={{
            color: "var(--color-text-subtle)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>

      {/* Expanded body */}
      {open && (
        <div
          className="flex flex-col gap-3 border-t px-4 pt-4 pb-4"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
        >
          {syncState === "stale" && (
            <div
              className="flex flex-col gap-2 rounded-lg border px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
              style={{
                borderColor: "color-mix(in srgb, var(--color-warning, #f59e0b) 35%, transparent)",
                background: "color-mix(in srgb, var(--color-warning, #f59e0b) 10%, var(--color-surface))",
                color: "var(--color-text-muted)",
              }}
              role="status"
              aria-live="polite"
            >
              <span>此供应商配置已在其他位置更新。继续保存会覆盖最新配置。</span>
              <Button variant="secondary" size="sm" onClick={syncLatestProvider}>
                <RefreshCw className="h-3.5 w-3.5" />
                同步最新
              </Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {/* Name */}
            <div className="col-span-2">
              <Field label="供应商名称">
                <Input
                  id={`${fieldPrefix}-name`}
                  name={`${fieldPrefix}-name`}
                  aria-label="供应商名称"
                  value={form.name}
                  onChange={(e) => {
                    set("name")(e.target.value);
                    setNameError("");
                  }}
                  placeholder="如：我的 DeepSeek"
                  error={nameError}
                />
              </Field>
            </div>

            {/* API Key */}
            <div className="col-span-2">
              <Field label="API Key" hint="仅存本地，写入 SQLite 数据库">
                <ApiKeyInput
                  id={`${fieldPrefix}-api-key`}
                  name={`${fieldPrefix}-api-key`}
                  aria-label="API Key"
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
                  id={`${fieldPrefix}-base-url`}
                  name={`${fieldPrefix}-base-url`}
                  aria-label="Base URL"
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
                  id={`${fieldPrefix}-model`}
                  name={`${fieldPrefix}-model`}
                  aria-label="当前模型"
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
                  id={`${fieldPrefix}-max-tokens`}
                  name={`${fieldPrefix}-max-tokens`}
                  aria-label="最大 Token 数"
                  type="number"
                  value={String(form.max_tokens)}
                  onChange={(e) =>
                    set("max_tokens")(
                      parseProviderPositiveIntegerDraft(e.target.value, form.max_tokens),
                    )
                  }
                />
              </Field>
            </div>

            {/* Temperature */}
            <div>
              <Field label="温度" hint="0~2">
                <Input
                  id={`${fieldPrefix}-temperature`}
                  name={`${fieldPrefix}-temperature`}
                  aria-label="温度"
                  type="number"
                  value={String(form.temperature)}
                  onChange={(e) =>
                    set("temperature")(
                      parseProviderTemperatureDraft(e.target.value, form.temperature),
                    )
                  }
                  placeholder="0.2"
                />
              </Field>
            </div>

            {/* Available models list */}
            <div className="col-span-2">
              <Field label="可用模型列表" hint="添加后可在上方下拉选择">
                <ModelListEditor
                  inputId={`${fieldPrefix}-model-list-input`}
                  inputName={`${fieldPrefix}-model-list-input`}
                  inputAriaLabel="可用模型列表输入"
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
            <Button variant="primary" size="sm" onClick={save} disabled={!hasChanges}>
              保存
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={test}
              disabled={testStatus === "testing"}
            >
              {testStatus === "testing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Activity className="h-3.5 w-3.5" />
              )}
              {testStatus === "testing" ? "测试中..." : "测试连接"}
            </Button>
            {!isActive && (
              <Button variant="secondary" size="sm" onClick={() => setActiveProvider(entry.name)}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                设为当前
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={copyProvider}>
              <Copy className="h-3.5 w-3.5" />
              复制
            </Button>
            {!isActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void deleteProvider()}
                disabled={deletePending}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deletePending ? "确认中..." : "删除"}
              </Button>
            )}
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}

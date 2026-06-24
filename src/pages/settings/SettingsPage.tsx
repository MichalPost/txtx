import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Download, RefreshCw, Save, ShieldCheck, Upload } from "lucide-react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { apiSaveTextFile } from "@/lib/api";
import { formatToolActionError } from "@/lib/toolActionError";
import { useAiStore } from "@/store/aiStore";
import { useConfigStore } from "@/store/configStore";

import { AdvancedNetworkSection } from "./sections/AdvancedNetworkSection";
import { AiSection } from "./sections/AiSection";
import { ConcurrencySection } from "./sections/ConcurrencySection";
import { EbookSection } from "./sections/EbookSection";
import { FilterSection } from "./sections/FilterSection";
import { NetworkSection } from "./sections/NetworkSection";
import { PathSection } from "./sections/PathSection";
import { PostScriptSection } from "./sections/PostScriptSection";
import { TextConversionSection } from "./sections/TextConversionSection";
import {
  buildSettingsChangeSummary,
  configToForm,
  formToConfig,
  parseImportedConfig,
  settingsSchema,
  type SettingsForm,
} from "./settingsSchema";

export function SettingsPage() {
  const { config, saveConfig, saving, loading, error, loadConfig } = useConfigStore();
  const flushAiSave = useAiStore((s) => s.flushSave);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const methods = useForm<SettingsForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(settingsSchema) as any,
    defaultValues: config ? configToForm(config) : undefined,
  });

  const {
    handleSubmit,
    reset,
    formState: { isDirty },
    watch,
  } = methods;
  const currentForm = watch();

  const appliedSnapshotRef = useRef<string | null>(null);
  const baselineFormRef = useRef<SettingsForm | null>(null);
  const configSyncVersionRef = useRef(0);
  useEffect(() => {
    if (!config) return;

    const nextForm = configToForm(config);
    const nextSnapshot = JSON.stringify(nextForm);
    if (appliedSnapshotRef.current === nextSnapshot) return;
    const syncVersion = configSyncVersionRef.current + 1;
    configSyncVersionRef.current = syncVersion;
    let cancelled = false;

    const applyConfigSnapshot = async () => {
      if (isDirty && appliedSnapshotRef.current !== null) {
        const shouldReplace = await confirm({
          title: "加载最新配置？",
          description: "检测到配置已在其他地方更新。加载最新配置会放弃当前未保存修改。",
          confirmLabel: "加载最新配置",
          tone: "warning",
        }).catch(() => false);
        if (!shouldReplace) return;
      }

      if (cancelled || configSyncVersionRef.current !== syncVersion) return;
      reset(nextForm);
      baselineFormRef.current = nextForm;
      appliedSnapshotRef.current = nextSnapshot;
    };

    void applyConfigSnapshot();

    return () => {
      cancelled = true;
    };
  }, [config, confirm, isDirty, reset]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (!config) return;
    const content = JSON.stringify(config, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    try {
      await apiSaveTextFile(`txtx-config-${date}.json`, content);
      toast.success("配置已导出");
    } catch (error) {
      toast.error(`导出失败：${String(error)}`);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = parseImportedConfig(JSON.parse(ev.target!.result as string));
        await saveConfig(parsed);
        const nextForm = configToForm(parsed);
        reset(nextForm);
        baselineFormRef.current = nextForm;
        appliedSnapshotRef.current = JSON.stringify(nextForm);
        toast.success("配置已导入并应用");
      } catch (err) {
        toast.error(`导入失败：${String(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const onSubmit = async (form: SettingsForm) => {
    if (!config) return;

    try {
      await Promise.all([saveConfig(formToConfig(form, config)), flushAiSave()]);
      reset(form);
      baselineFormRef.current = form;
      appliedSnapshotRef.current = JSON.stringify(form);
    } catch (error) {
      toast.error(formatToolActionError("保存设置", error));
    }
  };

  const changeSummary = useMemo(
    () =>
      baselineFormRef.current
        ? buildSettingsChangeSummary(currentForm, baselineFormRef.current, 6)
        : [],
    [currentForm],
  );

  if (loading && !config) {
    return (
      <div className="p-5" style={{ color: "var(--color-text-muted)" }}>
        正在加载...
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex h-full items-center justify-center p-5">
        <div
          className="flex w-full max-w-lg flex-col gap-4 rounded-2xl border px-5 py-5"
          style={{
            background: "var(--color-surface)",
            borderColor: "color-mix(in srgb, var(--color-danger) 28%, transparent)",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
            >
              <CircleAlert className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                设置加载失败
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                {error || "暂时无法读取本地配置，请确认后端已启动或稍后重试。"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void loadConfig({ force: true });
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重新加载
            </Button>
            <Link
              to="/rules"
              className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
                background: "var(--color-surface-2)",
              }}
            >
              先去规则管理
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(onSubmit as never)}
        className="flex h-full flex-col gap-4 overflow-hidden p-5"
      >
        <PageHeader
          title="通用设置"
          subtitle="目录、下载、网络、过滤统一在这里调整"
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label htmlFor="settings-import-file" className="sr-only">
                导入 JSON 配置文件
              </label>
              <input
                id="settings-import-file"
                ref={fileInputRef}
                type="file"
                accept=".json"
                name="settings-import-file"
                aria-label="导入 JSON 配置文件"
                className="hidden"
                onChange={handleFileImport}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                title="从 JSON 文件导入配置"
              >
                <Upload className="h-3.5 w-3.5" />
                导入
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleExport}
                title="将当前配置导出为 JSON"
              >
                <Download className="h-3.5 w-3.5" />
                导出
              </Button>
              <Button type="submit" size="sm" disabled={saving || !isDirty}>
                <Save className="h-3.5 w-3.5" />
                {saving ? "保存中..." : isDirty ? "保存*" : "已保存"}
              </Button>
            </div>
          }
        />

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="flex flex-col gap-4">
            {isDirty && (
              <div
                className="flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                style={{
                  background: "var(--color-warning-bg)",
                  borderColor: "color-mix(in srgb, var(--color-warning) 30%, transparent)",
                  color: "var(--color-text)",
                }}
                role="status"
                aria-live="polite"
              >
                <div className="min-w-0">
                  <p className="font-medium">有未保存的设置变更</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {changeSummary.length > 0
                      ? `已修改：${changeSummary.map((item) => item.label).join("、")}`
                      : "表单内容已变化，请保存或刷新配置。"}
                  </p>
                </div>
                <Button type="submit" size="sm" disabled={saving}>
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "保存中..." : "保存变更"}
                </Button>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="flex flex-col gap-4">
                <PathSection />
                <FilterSection />
                <TextConversionSection />
                <EbookSection />
              </div>

              <div className="flex flex-col gap-4">
                <NetworkSection />
                <ConcurrencySection />
                <AdvancedNetworkSection />
                <PostScriptSection />
              </div>
            </div>

            <div
              className="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center"
              style={{
                borderColor: "var(--color-border)",
                background: "var(--color-surface-1)",
              }}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
                  请求限速规则
                </span>
                <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                  现已移至规则管理页，在每个站点卡片展开后点击「限速规则」进行配置。
                </span>
              </div>
              <Link
                to="/rules"
                className="shrink-0 rounded-lg px-3 py-1.5 text-center text-xs font-medium transition-colors"
                style={{
                  background: "var(--color-accent)",
                  color: "#fff",
                }}
              >
                前往规则管理
              </Link>
            </div>
            <AiSection />
          </div>
        </div>
      </form>
      {confirmDialog}
    </FormProvider>
  );
}

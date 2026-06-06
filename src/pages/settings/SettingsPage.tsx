import { useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Save, ShieldCheck, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { apiSaveTextFile } from "@/lib/api";
import { useAiStore } from "@/store/aiStore";
import { useConfigStore } from "@/store/configStore";
import type { AppConfig } from "@/types";

import { AdvancedNetworkSection } from "./sections/AdvancedNetworkSection";
import { AiSection } from "./sections/AiSection";
import { ConcurrencySection } from "./sections/ConcurrencySection";
import { EbookSection } from "./sections/EbookSection";
import { FilterSection } from "./sections/FilterSection";
import { NetworkSection } from "./sections/NetworkSection";
import { PathSection } from "./sections/PathSection";
import { TextConversionSection } from "./sections/TextConversionSection";
import { configToForm, formToConfig, settingsSchema, type SettingsForm } from "./settingsSchema";

export function SettingsPage() {
  const { config, saveConfig, saving } = useConfigStore();
  const flushAiSave = useAiStore((s) => s.flushSave);

  const methods = useForm<SettingsForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(settingsSchema) as any,
    defaultValues: config ? configToForm(config) : undefined,
  });

  const {
    handleSubmit,
    reset,
    formState: { isDirty },
  } = methods;

  // Only reset when config is first loaded (not on every reference change)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (config && !initializedRef.current) {
      initializedRef.current = true;
      reset(configToForm(config));
    }
  }, [config, reset]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (!config) return;
    const content = JSON.stringify(config, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    await apiSaveTextFile(`txtx-config-${date}.json`, content);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target!.result as string) as AppConfig;
        await saveConfig(parsed);
        reset(configToForm(parsed));
        toast.success("配置已导入并应用");
      } catch (err) {
        toast.error(`导入失败: ${String(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (!config) {
    return (
      <div className="p-5" style={{ color: "var(--color-text-muted)" }}>
        正在加载...
      </div>
    );
  }

  const onSubmit = async (form: SettingsForm) => {
    try {
      await Promise.all([saveConfig(formToConfig(form, config)), flushAiSave()]);
      reset(form); // Mark form as clean after successful save
    } catch {
      toast.error("部分设置保存失败，请检查上方提示后重试");
    }
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(onSubmit as never)}
        className="flex h-full flex-col gap-4 overflow-hidden p-5"
      >
        <PageHeader
          title="通用设置"
          subtitle="网络、并发、路径、过滤参数"
          actions={
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
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
            </>
          }
        />

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="flex max-w-3xl flex-col gap-4">
            <PathSection />
            <NetworkSection />
            <ConcurrencySection />
            <FilterSection />
            <TextConversionSection />
            <EbookSection />
            {/* Rate-limit rules moved to Rules page — edit per-site under each site card */}
            <div
              className="flex items-center gap-3 rounded-xl border px-4 py-3"
              style={{
                borderColor: "var(--color-border)",
                background: "var(--color-surface-1)",
              }}
            >
              <ShieldCheck
                className="h-4 w-4 shrink-0"
                style={{ color: "var(--color-accent)" }}
              />
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
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: "var(--color-accent)",
                  color: "#fff",
                }}
              >
                前往规则管理
              </Link>
            </div>
            <AdvancedNetworkSection />
            <AiSection />
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

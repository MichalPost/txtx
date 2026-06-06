import { useEffect, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useConfigStore } from "@/store/configStore";
import { useAiStore } from "@/store/aiStore";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { settingsSchema, configToForm, formToConfig, type SettingsForm } from "./settingsSchema";
import { apiSaveTextFile } from "@/lib/api";
import type { AppConfig } from "@/types";
import { PathSection } from "./sections/PathSection";
import { NetworkSection } from "./sections/NetworkSection";
import { ConcurrencySection } from "./sections/ConcurrencySection";
import { FilterSection } from "./sections/FilterSection";
import { TextConversionSection } from "./sections/TextConversionSection";
import { EbookSection } from "./sections/EbookSection";
import { RateLimitRulesSection } from "./sections/RateLimitRulesSection";
import { AdvancedNetworkSection } from "./sections/AdvancedNetworkSection";
import { AiSection } from "./sections/AiSection";

export function SettingsPage() {
  const { config, saveConfig, saving } = useConfigStore();
  const flushAiSave = useAiStore((s) => s.flushSave);

  const methods = useForm<SettingsForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(settingsSchema) as any,
    defaultValues: config ? configToForm(config) : undefined,
  });

  const { handleSubmit, reset, formState: { isDirty } } = methods;

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
    return <div className="p-5" style={{ color: "var(--color-text-muted)" }}>正在加载...</div>;
  }

  const onSubmit = async (form: SettingsForm) => {
    try {
      await Promise.all([
        saveConfig(formToConfig(form, config)),
        flushAiSave(),
      ]);
      reset(form); // Mark form as clean after successful save
    } catch {
      toast.error("部分设置保存失败，请检查上方提示后重试");
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit as never)} className="flex flex-col h-full p-5 gap-4 overflow-hidden">
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
                <Upload className="w-3.5 h-3.5" />
                导入
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleExport}
                title="将当前配置导出为 JSON"
              >
                <Download className="w-3.5 h-3.5" />
                导出
              </Button>
              <Button type="submit" size="sm" disabled={saving || !isDirty}>
                <Save className="w-3.5 h-3.5" />
                {saving ? "保存中..." : isDirty ? "保存*" : "已保存"}
              </Button>
            </>
          }
        />

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="flex flex-col gap-4 max-w-3xl">
            <PathSection />
            <NetworkSection />
            <ConcurrencySection />
            <FilterSection />
            <TextConversionSection />
            <EbookSection />
            <RateLimitRulesSection />
            <AdvancedNetworkSection />
            <AiSection />
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

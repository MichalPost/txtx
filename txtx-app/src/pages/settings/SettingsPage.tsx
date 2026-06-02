import { useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useConfigStore } from "@/store/configStore";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { settingsSchema, configToForm, formToConfig, type SettingsForm } from "./settingsSchema";
import { PathSection } from "./sections/PathSection";
import { NetworkSection } from "./sections/NetworkSection";
import { ConcurrencySection } from "./sections/ConcurrencySection";
import { FilterSection } from "./sections/FilterSection";
import { EncodingMapSection } from "./sections/EncodingMapSection";
import { TextConversionSection } from "./sections/TextConversionSection";
import { EbookSection } from "./sections/EbookSection";
import { ContentFilterSection } from "./sections/ContentFilterSection";
import { TtksSection } from "./sections/TtksSection";
import { AdvancedNetworkSection } from "./sections/AdvancedNetworkSection";

export function SettingsPage() {
  const { config, saveConfig, saving } = useConfigStore();

  const methods = useForm<SettingsForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(settingsSchema) as any,
    defaultValues: config ? configToForm(config) : undefined,
  });

  const { handleSubmit, reset, formState: { isDirty } } = methods;

  // Sync when config loads
  useEffect(() => {
    if (config) reset(configToForm(config));
  }, [config, reset]);

  if (!config) {
    return <div className="p-5" style={{ color: "var(--color-text-muted)" }}>配置加载中...</div>;
  }

  const onSubmit = (form: SettingsForm) => saveConfig(formToConfig(form, config));

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit as never)} className="flex flex-col h-full p-5 gap-4 overflow-hidden">
        <PageHeader
          title="通用设置"
          subtitle="网络、并发、路径、过滤参数"
          actions={
            <Button type="submit" size="sm" disabled={saving || !isDirty}>
              <Save className="w-3.5 h-3.5" />
              {saving ? "保存中..." : isDirty ? "保存*" : "已保存"}
            </Button>
          }
        />

        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1">
          <PathSection />
          <NetworkSection />
          <ConcurrencySection />
          <FilterSection />
          <EncodingMapSection />
          <TextConversionSection />
          <EbookSection />
          <ContentFilterSection />
          <TtksSection />
          <AdvancedNetworkSection />
        </div>
      </form>
    </FormProvider>
  );
}

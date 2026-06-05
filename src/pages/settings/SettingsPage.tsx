import { useEffect, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useConfigStore } from "@/store/configStore";
import { useAiStore } from "@/store/aiStore";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { settingsSchema, configToForm, formToConfig, type SettingsForm } from "./settingsSchema";
import { PathSection } from "./sections/PathSection";
import { NetworkSection } from "./sections/NetworkSection";
import { ConcurrencySection } from "./sections/ConcurrencySection";
import { FilterSection } from "./sections/FilterSection";
import { ContentFilterSection } from "./sections/ContentFilterSection";
import { EncodingMapSection } from "./sections/EncodingMapSection";
import { TextConversionSection } from "./sections/TextConversionSection";
import { EbookSection } from "./sections/EbookSection";
import { TtksSection } from "./sections/TtksSection";
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
            <Button type="submit" size="sm" disabled={saving || !isDirty}>
              <Save className="w-3.5 h-3.5" />
              {saving ? "保存中..." : isDirty ? "保存*" : "已保存"}
            </Button>
          }
        />

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="flex flex-col gap-4 max-w-3xl">
            <PathSection />
            <NetworkSection />
            <ConcurrencySection />
            <FilterSection />
            <ContentFilterSection />
            <EncodingMapSection />
            <TextConversionSection />
            <EbookSection />
            <TtksSection />
            <AdvancedNetworkSection />
            <AiSection />
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

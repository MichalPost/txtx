import { useEffect } from "react";
import { Sparkles } from "lucide-react";

import { Card } from "@/components/Card";
import { Toggle } from "@/components/Toggle";
import { useAiStore } from "@/store/aiStore";

import { AddProviderForm } from "./ai/AddProviderForm";
import { ProviderCard } from "./ai/ProviderCard";

export function AiSection() {
  const { config, loaded, load, setEnabled } = useAiStore();

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

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
          <Toggle checked={config.enabled} onChange={setEnabled} />
        </div>
      }
    >
      {!config.enabled ? (
        <div className="flex items-center gap-3 py-2">
          <Sparkles className="h-5 w-5 shrink-0" style={{ color: "var(--color-text-subtle)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            启用 AI 助手后，可在源码查看器和网站配置中使用智能 XPath 生成功能。
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Active provider summary */}
          {providers.length > 1 && (
            <div
              className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-xs"
              style={{
                background: "color-mix(in srgb, var(--color-accent) 6%, var(--color-surface-2))",
                border:
                  "1px solid color-mix(in srgb, var(--color-accent) 15%, var(--color-border))",
                color: "var(--color-text-muted)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
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
            <ProviderCard key={p.name} entry={p} isActive={p.name === active} allNames={allNames} />
          ))}

          {/* Add provider */}
          <AddProviderForm allNames={allNames} />
        </div>
      )}
    </Card>
  );
}

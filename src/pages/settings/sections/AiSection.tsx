import { useEffect, useState } from "react";
import { Sparkles, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Toggle } from "@/components/Toggle";
import { useAiStore, AI_PROVIDER_PRESETS, type AiProvider } from "@/store/aiStore";

const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai:   "OpenAI",
  deepseek: "DeepSeek（推荐，性价比高）",
  ollama:   "Ollama（本地模型）",
  longcat:  "LongCat（高并发场景）",
  iflow:    "iFlow（GLM 系列）",
  custom:   "自定义",
};

// debounce save timer ref (module level to avoid closure issues)
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function AiSection() {
  const { config, loaded, load, update, save, testConnection, testStatus, testMessage } = useAiStore();
  const [showKey, setShowKey] = useState(false);

  useEffect(() => { if (!loaded) load(); }, [loaded, load]);

  const handleProviderChange = (provider: AiProvider) => {
    const preset = AI_PROVIDER_PRESETS[provider];
    update({ ...preset, provider });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(), 600);
  };

  const handleChange = (field: keyof typeof config, value: string | number | boolean) => {
    update({ [field]: value });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(), 600);
  };

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
            onChange={(v) => { update({ enabled: v }); save(); }}
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
        <div className="grid grid-cols-2 gap-4">
          {/* Provider */}
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              服务商
            </label>
            <select
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              value={config.provider}
              onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
            >
              {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((p) => (
                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
              ))}
            </select>
          </div>

          {/* Base URL */}
          <div className="col-span-2">
            <Input
              label="Base URL"
              value={config.base_url}
              placeholder="https://api.openai.com/v1"
              onChange={(e) => handleChange("base_url", e.target.value)}
            />
          </div>

          {/* API Key */}
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              API Key
              <span className="ml-1.5 font-normal" style={{ color: "var(--color-text-subtle)" }}>
                （仅存本地，不写入配置文件）
              </span>
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={config.api_key}
                onChange={(e) => handleChange("api_key", e.target.value)}
                placeholder={config.provider === "ollama" ? "Ollama 无需 Key" : "sk-..."}
                className="w-full border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none"
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded transition-opacity hover:opacity-70"
                style={{ color: "var(--color-text-subtle)" }}
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Model */}
          <div>
            <Input
              label="模型名称"
              value={config.model}
              placeholder="gpt-4o-mini"
              onChange={(e) => handleChange("model", e.target.value)}
            />
          </div>

          {/* Max tokens */}
          <div>
            <Input
              label="最大 Token 数"
              type="number"
              value={String(config.max_tokens)}
              onChange={(e) => handleChange("max_tokens", parseInt(e.target.value, 10) || 2048)}
            />
          </div>

          {/* Test connection */}
          <div className="col-span-2 flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={testConnection}
              disabled={testStatus === "testing"}
            >
              {testStatus === "testing"
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Sparkles className="w-3.5 h-3.5" />}
              {testStatus === "testing" ? "测试中..." : "测试连接"}
            </Button>
            {testStatus === "ok" && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-success)" }}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {testMessage}
              </span>
            )}
            {testStatus === "error" && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-danger)" }}>
                <XCircle className="w-3.5 h-3.5" />
                {testMessage}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

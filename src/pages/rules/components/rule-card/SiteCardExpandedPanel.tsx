import { useState } from "react";
import { Code2, ShieldCheck, Sparkles, Wand2 } from "lucide-react";

import { AiXPathAnalyzer } from "@/components/AiXPathAnalyzer";
import { RuleTemplateSelector } from "@/components/RuleTemplateSelector";
import { SourceViewer } from "@/components/SourceViewer";
import { useAiStore } from "@/store/aiStore";
import type { WebsiteConfig } from "@/types";

import { SiteRateLimitEditor } from "./SiteRateLimitEditor";
import { ToolBtn } from "./ToolBtn";

interface SiteCardExpandedPanelProps {
  site: WebsiteConfig;
  onClose: () => void;
  onQuickSave: (patch: Partial<WebsiteConfig>) => void;
}

export function SiteCardExpandedPanel({ site, onClose, onQuickSave }: SiteCardExpandedPanelProps) {
  const [draftDomain, setDraftDomain] = useState(site.domain_name);
  const [draftReleaseUrl, setDraftReleaseUrl] = useState(site.release_url);
  const [activePanel, setActivePanel] = useState<"template" | "ai" | "source" | "ratelimit" | null>(null);

  const aiEnabled = useAiStore((s) => s.config.enabled);

  // Clean domain display: strip protocol, trailing slash
  const displayDomain =
    site.domain_name.replace(/^https?:\/\//, "").replace(/\/$/, "") || site.domain_name;

  return (
    <div
      className="mt-3 flex flex-col gap-2 border-t pt-3"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-2">
        <label className="w-14 shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
          域名
        </label>
        <input
          className="flex-1 rounded-lg border px-2 py-1 text-xs"
          style={{
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
            outline: "none",
          }}
          value={draftDomain}
          onChange={(e) => setDraftDomain(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="w-14 shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
          更新页
        </label>
        <input
          className="flex-1 rounded-lg border px-2 py-1 text-xs"
          style={{
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
            outline: "none",
          }}
          value={draftReleaseUrl}
          onChange={(e) => setDraftReleaseUrl(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={() => {
            onClose();
            setActivePanel(null);
            setDraftDomain(site.domain_name);
            setDraftReleaseUrl(site.release_url);
          }}
          className="rounded-lg border px-3 py-1 text-xs transition-colors"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-text-muted)",
            background: "transparent",
          }}
        >
          取消
        </button>
        <button
          onClick={() => {
            onQuickSave({
              domain_name: draftDomain.trim() || site.domain_name,
              release_url: draftReleaseUrl.trim(),
            });
            onClose();
            setActivePanel(null);
          }}
          className="rounded-lg px-3 py-1 text-xs"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          保存
        </button>
      </div>

      {/* Advanced tools toolbar */}
      <div
        className="mt-2 flex flex-wrap gap-1.5 border-t pt-2"
        style={{ borderColor: "var(--color-border)" }}
      >
        <ToolBtn
          active={activePanel === "ratelimit"}
          onClick={() => setActivePanel((p) => (p === "ratelimit" ? null : "ratelimit"))}
          icon={<ShieldCheck className="h-3 w-3" />}
          label="限速规则"
        />
        <ToolBtn
          active={activePanel === "template"}
          onClick={() => setActivePanel((p) => (p === "template" ? null : "template"))}
          icon={<Wand2 className="h-3 w-3" />}
          label="规则模板"
        />
        {aiEnabled && (
          <ToolBtn
            active={activePanel === "ai"}
            onClick={() => setActivePanel((p) => (p === "ai" ? null : "ai"))}
            icon={<Sparkles className="h-3 w-3" />}
            label="AI 分析"
          />
        )}
        <ToolBtn
          active={activePanel === "source"}
          onClick={() => setActivePanel((p) => (p === "source" ? null : "source"))}
          icon={<Code2 className="h-3 w-3" />}
          label="源码查看器"
        />
      </div>

      {/* Panel content */}
      {activePanel === "ratelimit" && (
        <div
          className="mt-2 rounded-xl border p-3"
          style={{
            background: "var(--color-surface-1)",
            borderColor: "var(--color-border)",
          }}
        >
          <SiteRateLimitEditor displayDomain={displayDomain} />
        </div>
      )}
      {activePanel === "template" && (
        <div className="mt-2">
          <RuleTemplateSelector
            onApply={(patch) => {
              onQuickSave(patch);
              setActivePanel(null);
            }}
            onClose={() => setActivePanel(null)}
          />
        </div>
      )}
      {activePanel === "ai" && (
        <div className="mt-2">
          <AiXPathAnalyzer
            site={site}
            onApply={(patch) => {
              onQuickSave(patch);
              setActivePanel(null);
            }}
            onClose={() => setActivePanel(null)}
          />
        </div>
      )}
      {activePanel === "source" && (
        <div className="mt-2">
          <SourceViewer
            defaultUrl={site.domain_name}
            onXPathSelect={(xpath, field) =>
              onQuickSave({ [field as keyof WebsiteConfig]: xpath } as Partial<WebsiteConfig>)
            }
            onClose={() => setActivePanel(null)}
          />
        </div>
      )}
    </div>
  );
}

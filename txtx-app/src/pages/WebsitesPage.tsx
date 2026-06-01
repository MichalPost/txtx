import { useState } from "react";
import type React from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Save } from "lucide-react";
import { useConfigStore } from "@/store/configStore";
import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Input";
import { Toggle } from "@/components/Toggle";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import type { WebsiteConfig } from "@/types";

const defaultWebsite: WebsiteConfig = {
  enabled: true,
  domain_name: "https://",
  release_date: "",
  release_url: "",
  list_novel_name: "",
  novel_content: "",
  novel_name_x: "",
  chapter_url_x: "",
  page_list: ["/tongren"],
};

function WebsiteEditor({
  siteKey,
  site,
  onChange,
  onDelete,
}: {
  siteKey: string;
  site: WebsiteConfig;
  onChange: (s: WebsiteConfig) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const field = (key: keyof WebsiteConfig, label: string, placeholder?: string) => (
    <Input
      label={label}
      value={site[key] as string}
      placeholder={placeholder}
      onChange={(e) => onChange({ ...site, [key]: e.target.value })}
    />
  );

  return (
    <div
      className="rounded-xl border"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* Header row */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${expanded ? "rounded-t-xl" : "rounded-xl"}`}
        style={{ background: "var(--color-surface-2)" }}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
        )}
        <Toggle
          checked={site.enabled}
          onChange={(v) => onChange({ ...site, enabled: v })}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        />
        <span
          className="flex-1 text-sm font-medium truncate"
          style={{ color: "var(--color-text)" }}
        >
          {siteKey} — {site.domain_name}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{ color: "var(--color-danger)" }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Body */}
      {expanded && (
        <div
          className="p-4 grid grid-cols-2 gap-4 rounded-b-xl"
          style={{ background: "var(--color-surface)" }}
        >
          {field("domain_name", "域名", "https://example.com")}
          {field("list_novel_name", "列表页书名 XPath")}
          {field("release_date", "发布日期 XPath")}
          {field("release_url", "发布链接 XPath")}
          {field("novel_name_x", "详情页书名 XPath")}
          {field("chapter_url_x", "章节链接 XPath")}
          {field("novel_content", "章节内容 XPath")}
          <div className="col-span-2">
            <Textarea
              label="页面列表（每行一个路径）"
              rows={6}
              value={site.page_list.join("\n")}
              onChange={(e) =>
                onChange({
                  ...site,
                  page_list: e.target.value
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function WebsitesPage() {
  const { config, saveConfig, saving } = useConfigStore();

  if (!config) return <div className="p-5" style={{ color: "var(--color-text-muted)" }}>配置加载中...</div>;

  const websites = config.websites;

  const addSite = () => {
    const key = `web${Object.keys(websites).length + 1}`;
    saveConfig({ ...config, websites: { ...websites, [key]: { ...defaultWebsite } } });
  };

  const updateSite = (key: string, site: WebsiteConfig) => {
    saveConfig({ ...config, websites: { ...websites, [key]: site } });
  };

  const deleteSite = (key: string) => {
    const updated = { ...websites };
    delete updated[key];
    saveConfig({ ...config, websites: updated });
  };

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">
      <PageHeader
        title="网站配置"
        subtitle="管理爬取站点的 XPath 规则"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={addSite}>
              <Plus className="w-3.5 h-3.5" /> 添加站点
            </Button>
            <Button size="sm" onClick={() => saveConfig(config)} disabled={saving}>
              <Save className="w-3.5 h-3.5" /> {saving ? "保存中..." : "保存"}
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
        {Object.entries(websites).map(([key, site]) => (
          <WebsiteEditor
            key={key}
            siteKey={key}
            site={site}
            onChange={(s) => updateSite(key, s)}
            onDelete={() => deleteSite(key)}
          />
        ))}
        {Object.keys(websites).length === 0 && (
          <Card>
            <p className="text-center text-sm py-8" style={{ color: "var(--color-text-muted)" }}>
              暂无站点配置，点击「添加站点」开始
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

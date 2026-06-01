import { Save, FolderOpen } from "lucide-react";
import { apiPickDirectory } from "@/lib/api";
import { useConfigStore } from "@/store/configStore";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";

export function SettingsPage() {
  const { config, saveConfig, saving } = useConfigStore();

  if (!config) return <div className="p-5" style={{ color: "var(--color-text-muted)" }}>配置加载中...</div>;

  const handleSave = () => saveConfig(config);

  const update = (path: string[], value: unknown) => {
    // Use unknown cast to safely traverse nested config
    const next = structuredClone(config) as unknown as Record<string, unknown>;
    let cur = next as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      cur = cur[path[i]] as Record<string, unknown>;
    }
    cur[path[path.length - 1]] = value;
    useConfigStore.setState({ config: next as unknown as typeof config });
  };

  const pickDir = async () => {
    const selected = await apiPickDirectory();
    if (selected) update(["paths", "base_dir"], selected);
  };

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">
      <PageHeader
        title="通用设置"
        subtitle="网络、并发、路径、过滤参数"
        actions={
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-3.5 h-3.5" />
            {saving ? "保存中..." : "保存"}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1">
        {/* Paths */}
        <Card title="路径配置">
          <div className="grid grid-cols-1 gap-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  label="下载目录"
                  value={config.paths.base_dir}
                  onChange={(e) => update(["paths", "base_dir"], e.target.value)}
                />
              </div>
              <Button variant="secondary" size="md" onClick={pickDir}>
                <FolderOpen className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Network */}
        <Card title="网络配置">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label="User-Agent"
                value={config.network.user_agent}
                onChange={(e) => update(["network", "user_agent"], e.target.value)}
              />
            </div>
            <Input
              label="代理地址（留空不使用）"
              value={config.network.proxy ?? ""}
              placeholder="http://127.0.0.1:7890"
              onChange={(e) => update(["network", "proxy"], e.target.value || null)}
            />
            <Input
              label="超时（秒）"
              type="number"
              min={5}
              max={120}
              value={config.network.timeout}
              onChange={(e) => update(["network", "timeout"], Number(e.target.value))}
            />
            <Input
              label="重试次数"
              type="number"
              min={0}
              max={10}
              value={config.network.retry_count}
              onChange={(e) => update(["network", "retry_count"], Number(e.target.value))}
            />
            <Input
              label="重试间隔（秒）"
              type="number"
              min={1}
              max={30}
              value={config.network.retry_delay}
              onChange={(e) => update(["network", "retry_delay"], Number(e.target.value))}
            />
          </div>
        </Card>

        {/* Concurrency */}
        <Card title="并发配置">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="小说并发数"
              type="number"
              min={1}
              max={10}
              value={config.concurrency.novel_threads}
              onChange={(e) => update(["concurrency", "novel_threads"], Number(e.target.value))}
            />
            <Input
              label="章节并发数"
              type="number"
              min={1}
              max={20}
              value={config.concurrency.chapter_threads}
              onChange={(e) => update(["concurrency", "chapter_threads"], Number(e.target.value))}
            />
            <Input
              label="每主机最大连接数"
              type="number"
              min={1}
              max={50}
              value={config.concurrency.max_connections_per_host}
              onChange={(e) => update(["concurrency", "max_connections_per_host"], Number(e.target.value))}
            />
          </div>
        </Card>

        {/* Filtering */}
        <Card title="过滤配置">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="最大天数限制"
              type="number"
              min={1}
              max={365}
              value={config.filtering.days_limit}
              onChange={(e) => update(["filtering", "days_limit"], Number(e.target.value))}
            />
            <Input
              label="最小天数限制"
              type="number"
              min={1}
              max={30}
              value={config.filtering.min_days_limit}
              onChange={(e) => update(["filtering", "min_days_limit"], Number(e.target.value))}
            />
            <div className="col-span-2">
              <Input
                label="上次下载日期（YYYY-MM-DD，留空则按最大天数）"
                value={config.filtering.last_download_date ?? ""}
                placeholder="2026-01-01"
                onChange={(e) => update(["filtering", "last_download_date"], e.target.value || null)}
              />
            </div>
          </div>
        </Card>

        {/* Encoding map */}
        <Card title="编码映射">
          <div className="flex flex-col gap-2">
            {Object.entries(config.network.encoding_map).map(([domain, enc]) => (
              <div key={domain} className="flex gap-2 items-center">
                <Input
                  className="flex-1"
                  value={domain}
                  onChange={(e) => {
                    const map = { ...config.network.encoding_map };
                    delete map[domain];
                    map[e.target.value] = enc;
                    update(["network", "encoding_map"], map);
                  }}
                />
                <Input
                  className="w-24"
                  value={enc}
                  onChange={(e) => {
                    update(["network", "encoding_map"], { ...config.network.encoding_map, [domain]: e.target.value });
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const map = { ...config.network.encoding_map };
                    delete map[domain];
                    update(["network", "encoding_map"], map);
                  }}
                  className="text-[var(--color-danger)] shrink-0"
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              className="self-start mt-1"
              onClick={() => update(["network", "encoding_map"], { ...config.network.encoding_map, "": "gbk" })}
            >
              + 添加编码规则
            </Button>
          </div>
        </Card>

        {/* Text conversion */}
        <Card title="繁简转换">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex items-center gap-3">
              <input
                type="checkbox"
                id="tc-enabled"
                checked={config.text_conversion?.enabled ?? false}
                onChange={(e) => update(["text_conversion", "enabled"], e.target.checked)}
              />
              <label htmlFor="tc-enabled" className="text-sm" style={{ color: "var(--color-text)" }}>
                启用繁简转换
              </label>
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <input
                type="checkbox"
                id="tc-t2s"
                checked={config.text_conversion?.traditional_to_simplified ?? false}
                onChange={(e) => update(["text_conversion", "traditional_to_simplified"], e.target.checked)}
                disabled={!config.text_conversion?.enabled}
              />
              <label htmlFor="tc-t2s" className="text-sm" style={{ color: "var(--color-text)" }}>
                繁体 → 简体
              </label>
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <input
                type="checkbox"
                id="tc-auto"
                checked={config.text_conversion?.auto_detect ?? true}
                onChange={(e) => update(["text_conversion", "auto_detect"], e.target.checked)}
                disabled={!config.text_conversion?.enabled}
              />
              <label htmlFor="tc-auto" className="text-sm" style={{ color: "var(--color-text)" }}>
                自动检测（仅含繁体字时才转换）
              </label>
            </div>
          </div>
        </Card>

        {/* Ebook conversion */}
        <Card title="电子书转换">
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="eb-enabled"
                checked={config.ebook_conversion?.enabled ?? false}
                onChange={(e) => update(["ebook_conversion", "enabled"], e.target.checked)}
              />
              <label htmlFor="eb-enabled" className="text-sm" style={{ color: "var(--color-text)" }}>
                下载完成后自动转换
              </label>
            </div>
            <div>
              <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>输出格式</p>
              <div className="flex gap-4">
                {["epub", "mobi", "azw3"].map((fmt) => {
                  const formats = config.ebook_conversion?.formats ?? [];
                  const checked = formats.includes(fmt);
                  return (
                    <label key={fmt} className="flex items-center gap-2 text-sm cursor-pointer"
                      style={{ color: "var(--color-text)" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!config.ebook_conversion?.enabled}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...formats, fmt]
                            : formats.filter((f) => f !== fmt);
                          update(["ebook_conversion", "formats"], next);
                        }}
                      />
                      {fmt.toUpperCase()}
                    </label>
                  );
                })}
              </div>
            </div>
            <Input
              label="Calibre 路径（留空自动检测，MOBI/AZW3 需要）"
              value={config.ebook_conversion?.calibre_path ?? ""}
              placeholder="C:\Program Files\Calibre2\ebook-convert.exe"
              disabled={!config.ebook_conversion?.enabled}
              onChange={(e) => update(["ebook_conversion", "calibre_path"], e.target.value || null)}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

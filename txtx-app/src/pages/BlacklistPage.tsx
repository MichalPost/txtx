import { useState, useRef } from "react";
import { Plus, Trash2, Save, Search } from "lucide-react";
import { useConfigStore } from "@/store/configStore";
import { Button } from "@/components/Button";
import { Toggle } from "@/components/Toggle";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";

export function BlacklistPage() {
  const { config, saveConfig, saving } = useConfigStore();
  const [search, setSearch] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newRegex, setNewRegex] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!config) return <div className="p-5" style={{ color: "var(--color-text-muted)" }}>配置加载中...</div>;

  const bl = config.blacklist;

  const update = (patch: Partial<typeof bl>) => {
    useConfigStore.setState({ config: { ...config, blacklist: { ...bl, ...patch } } });
  };

  const handleSave = () => saveConfig(config);

  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (!kw || bl.keywords.includes(kw)) return;
    update({ keywords: [...bl.keywords, kw] });
    setNewKeyword("");
    inputRef.current?.focus();
  };

  const removeKeyword = (kw: string) => {
    update({ keywords: bl.keywords.filter((k) => k !== kw) });
  };

  const addRegex = () => {
    const r = newRegex.trim();
    if (!r || bl.regex_patterns.includes(r)) return;
    update({ regex_patterns: [...bl.regex_patterns, r] });
    setNewRegex("");
  };

  const removeRegex = (r: string) => {
    update({ regex_patterns: bl.regex_patterns.filter((p) => p !== r) });
  };

  const filtered = bl.keywords.filter((k) => !search || k.includes(search));

  /* ── shared inline input style ── */
  const inlineInputStyle = {
    background: "var(--color-surface-2)",
    borderColor: "var(--color-border)",
    color: "var(--color-text)",
  } as const;

  const inlineInputClass =
    "border rounded-lg px-3 py-1.5 text-sm focus:outline-none transition-colors";

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">
      <PageHeader
        title="黑名单管理"
        subtitle={`共 ${bl.keywords.length} 个关键词，${bl.regex_patterns.length} 个正则`}
        actions={
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-3.5 h-3.5" />
            {saving ? "保存中..." : "保存"}
          </Button>
        }
      />

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: keywords */}
        <div className="flex flex-col flex-1 gap-3 min-h-0">
          <Card
            title="关键词列表"
            className="flex flex-col flex-1 min-h-0"
            bodyClassName="flex flex-col flex-1 min-h-0 overflow-hidden"
            actions={
              <div className="relative">
                <Search
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: "var(--color-text-muted)" }}
                />
                <input
                  className={`pl-7 pr-3 py-1 text-xs w-40 ${inlineInputClass}`}
                  style={inlineInputStyle}
                  placeholder="搜索关键词..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-accent)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-border)";
                  }}
                />
              </div>
            }
          >
            {/* Add input */}
            <div className="flex gap-2 mb-3">
              <input
                ref={inputRef}
                className={`flex-1 ${inlineInputClass}`}
                style={inlineInputStyle}
                placeholder="输入关键词后按 Enter 添加"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-accent)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <Button size="sm" onClick={addKeyword}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Keyword grid */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {filtered.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border"
                    style={{
                      background: "var(--color-surface-2)",
                      borderColor: "var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  >
                    {kw}
                    <button
                      onClick={() => removeKeyword(kw)}
                      className="ml-0.5 cursor-pointer transition-colors hover:opacity-70"
                      style={{ color: "var(--color-text-muted)" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {filtered.length === 0 && (
                  <p
                    className="text-xs py-4 w-full text-center"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {search ? "无匹配关键词" : "暂无关键词"}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right: settings + regex */}
        <div className="flex flex-col gap-3 w-72 shrink-0">
          {/* Filter settings */}
          <Card title="过滤设置">
            <div className="flex flex-col gap-4">
              <Toggle
                checked={bl.enabled}
                onChange={(v) => update({ enabled: v })}
                label="启用黑名单"
              />
              <div className="flex flex-col gap-1">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  过滤级别
                </label>
                <select
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors"
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                  value={bl.filter_level}
                  onChange={(e) =>
                    update({ filter_level: e.target.value as typeof bl.filter_level })
                  }
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-accent)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-border)";
                  }}
                >
                  <option value="strict">严格</option>
                  <option value="moderate">中等</option>
                  <option value="mild">宽松</option>
                </select>
              </div>
              <Toggle
                checked={bl.case_insensitive}
                onChange={(v) => update({ case_insensitive: v })}
                label="大小写不敏感"
              />
              <Toggle
                checked={bl.fuzzy_match}
                onChange={(v) => update({ fuzzy_match: v })}
                label="模糊匹配（包含即过滤）"
              />
              <Toggle
                checked={bl.regex_match}
                onChange={(v) => update({ regex_match: v })}
                label="启用正则匹配"
              />
            </div>
          </Card>

          {/* Regex patterns */}
          <Card title="正则规则">
            <div className="flex gap-2 mb-3">
              <input
                className={`flex-1 font-mono ${inlineInputClass}`}
                style={inlineInputStyle}
                placeholder="正则表达式"
                value={newRegex}
                onChange={(e) => setNewRegex(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRegex()}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-accent)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-muted)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <Button size="sm" onClick={addRegex}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              {bl.regex_patterns.map((r) => (
                <div
                  key={r}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                  style={{
                    background: "var(--color-surface-2)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <code
                    className="flex-1 text-xs font-mono truncate"
                    style={{ color: "var(--color-accent)" }}
                  >
                    {r}
                  </code>
                  <button
                    onClick={() => removeRegex(r)}
                    className="cursor-pointer transition-colors"
                    style={{ color: "var(--color-text-muted)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {bl.regex_patterns.length === 0 && (
                <p
                  className="text-xs text-center py-3"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  暂无正则规则
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

# Feature Enrichment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为规则管理、过滤中心、设置、书架、任务管理五个模块补充缺失功能，提升实用性。

**Architecture:** 全部为纯前端改动，复用已有的 CSS 变量设计系统、Zustand 存储和 API 层模式，不引入新依赖。书架功能通过 Tauri `fs` plugin 或后端 REST 接口读取本地文件，复用已有 `apiPickDirectory`/`apiOpenOutputDir` 模式。

**Tech Stack:** React 19 + TypeScript + Zustand + Tailwind v4 CSS vars + lucide-react + sonner toasts + Tauri (conditional)

---

## 任务概览

| # | 模块 | 功能 |
|---|------|------|
| 1 | 规则管理 | 规则健康状态（成功/失败标记） |
| 2 | 规则管理 | 列表内联快速编辑域名/启用状态 |
| 3 | 过滤中心 | 黑名单测试输入（验证书名是否被过滤） |
| 4 | 过滤中心 | 白名单机制 |
| 5 | 设置 | Calibre 自动检测安装路径 |
| 6 | 设置 | 配置备份/恢复（导出/导入 YAML） |
| 7 | 书架 | 新页面：本地书架文件浏览 |
| 8 | 任务管理 | 按站点筛选 + 失败书目导出 |
| 9 | 任务管理 | 扫描结果排序 |
| 10 | 任务管理 | 定时/每日自动扫描 |
| 11 | 任务管理 | 完成后打开保存目录按钮 |

---

## Task 1: 规则健康状态

规则每次被使用后，把"成功/失败/时间"记录到 `localStorage`（key：`rule-health`），然后在 `SiteRuleCard` 中展示。

**Files:**
- Create: `src/lib/ruleHealth.ts`
- Modify: `src/pages/rules/components/SiteRuleCard.tsx`
- Modify: `src/pages/rules/useRulesPageActions.ts`

**Step 1: 创建 ruleHealth 模块**

```typescript
// src/lib/ruleHealth.ts
export interface RuleHealthEntry {
  siteKey: string;
  lastUsed: string;       // ISO timestamp
  lastStatus: "success" | "error";
  successCount: number;
  errorCount: number;
  lastError?: string;
}

const STORAGE_KEY = "rule-health";

export function loadRuleHealth(): Record<string, RuleHealthEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveRuleHealth(map: Record<string, RuleHealthEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function recordRuleUsage(
  siteKey: string,
  status: "success" | "error",
  errorMsg?: string
): void {
  const map = loadRuleHealth();
  const prev = map[siteKey] ?? { siteKey, lastUsed: "", lastStatus: "success", successCount: 0, errorCount: 0 };
  map[siteKey] = {
    ...prev,
    lastUsed: new Date().toISOString(),
    lastStatus: status,
    successCount: status === "success" ? prev.successCount + 1 : prev.successCount,
    errorCount: status === "error" ? prev.errorCount + 1 : prev.errorCount,
    lastError: status === "error" ? errorMsg : prev.lastError,
  };
  saveRuleHealth(map);
}
```

**Step 2: 在 SiteRuleCard 中展示健康状态**

在 `SiteRuleCard.tsx` 中，在现有 status badges 区域加入健康信息：

```typescript
// 在组件顶部 import
import { loadRuleHealth } from "@/lib/ruleHealth";
import { Activity } from "lucide-react";

// 在 SiteRuleCard 组件内，在 return 前
const health = loadRuleHealth()[siteKey];
```

在 status badges 区域（现有 `{site.encoding?.trim() && ...}` 之前）添加：

```tsx
{health && (
  <span
    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
    style={{
      background: health.lastStatus === "success"
        ? "var(--color-success-bg)"
        : "var(--color-danger-bg)",
      color: health.lastStatus === "success"
        ? "var(--color-success)"
        : "var(--color-danger)",
      fontSize: "11px",
    }}
    title={`上次使用: ${new Date(health.lastUsed).toLocaleString("zh-CN")}\n成功 ${health.successCount} 次，失败 ${health.errorCount} 次${health.lastError ? `\n错误: ${health.lastError}` : ""}`}
  >
    <Activity className="w-2.5 h-2.5" />
    {health.lastStatus === "success" ? "上次成功" : "上次失败"}
  </span>
)}
```

**Step 3: 在 taskEventHandler 中记录健康**

```typescript
// 在 src/store/taskEventHandler.ts 中，当 event.type === "novel_done" 时调用：
import { recordRuleUsage } from "@/lib/ruleHealth";
// 在 applyTaskEvent 内，novel_done 分支：
// recordRuleUsage(taskSiteKey, "success");
// novel_error 分支：
// recordRuleUsage(taskSiteKey, "error", event.message);
```

注意：`novel_done`/`novel_error` 事件中有 `site` 字段，需要映射到规则 key。由于 site 字段对应 `domain_name`（非 siteKey），改为在 `ScanItem.site` 中匹配。更简单的方案：直接记录 domain，用 domain 作为 key（而非内部 `webN` key）。

修正方案：`ruleHealth` 以 domain（去协议）为 key，`SiteRuleCard` 查找时用 `displayDomain`。

更新 `ruleHealth.ts` 的函数签名中 `siteKey` → `domain`。

**Step 4: 验证**

运行 `pnpm run build --mode development` 确认无 TS 错误。

**Step 5: Commit**

```bash
git add src/lib/ruleHealth.ts src/pages/rules/components/SiteRuleCard.tsx src/store/taskEventHandler.ts
git commit -m "feat(rules): add rule health status badges"
```

---

## Task 2: 规则列表快速编辑

在 `SiteRuleCard` 中增加"快速编辑"展开区，点击后可以直接修改 `domain_name`、`release_url`、`enabled` 三个最常用字段，不必进入向导。

**Files:**
- Modify: `src/pages/rules/components/SiteRuleCard.tsx`
- Modify: `src/pages/rules/components/SiteList.tsx`

**Step 1: SiteRuleCard 增加展开状态和内联编辑 UI**

将 `SiteRuleCard` 改为受控组件，接受 `onQuickSave` 回调：

```typescript
interface SiteRuleCardProps {
  siteKey: string;
  site: WebsiteConfig;
  status: CardStatus;
  highlighted?: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onQuickSave: (patch: Partial<WebsiteConfig>) => void; // 新增
}
```

内部增加 `expanded` state 和内联编辑面板：

```tsx
const [expanded, setExpanded] = useState(false);
const [draftDomain, setDraftDomain] = useState(site.domain_name);
const [draftReleaseUrl, setDraftReleaseUrl] = useState(site.release_url);
```

在卡片底部（actions 下方）条件渲染展开面板：

```tsx
{expanded && (
  <div
    className="w-full mt-3 pt-3 border-t flex flex-col gap-2"
    style={{ borderColor: "var(--color-border)" }}
  >
    <div className="flex gap-2 items-center">
      <label className="text-xs w-20 shrink-0" style={{ color: "var(--color-text-muted)" }}>域名</label>
      <input
        className="flex-1 text-xs px-2 py-1 rounded-lg border"
        style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        value={draftDomain}
        onChange={e => setDraftDomain(e.target.value)}
      />
    </div>
    <div className="flex gap-2 items-center">
      <label className="text-xs w-20 shrink-0" style={{ color: "var(--color-text-muted)" }}>更新页</label>
      <input
        className="flex-1 text-xs px-2 py-1 rounded-lg border"
        style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        value={draftReleaseUrl}
        onChange={e => setDraftReleaseUrl(e.target.value)}
      />
    </div>
    <div className="flex justify-end gap-2">
      <button
        onClick={() => { setExpanded(false); setDraftDomain(site.domain_name); setDraftReleaseUrl(site.release_url); }}
        className="text-xs px-3 py-1 rounded-lg border"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
      >取消</button>
      <button
        onClick={() => {
          onQuickSave({ domain_name: draftDomain.trim(), release_url: draftReleaseUrl.trim() });
          setExpanded(false);
        }}
        className="text-xs px-3 py-1 rounded-lg"
        style={{ background: "var(--color-accent)", color: "#fff" }}
      >保存</button>
    </div>
  </div>
)}
```

在 ActionButton 区域添加一个 "快速编辑" 按钮（展开/收起）替代或补充原有的 Edit 按钮：
在 `ActionButton` 的 "编辑"（打开向导）旁，增加一个展开图标按钮（ChevronDown/ChevronUp）触发 `setExpanded`。

**Step 2: SiteList 传递 onQuickSave**

```typescript
// SiteList props 增加
onQuickSave: (key: string, patch: Partial<WebsiteConfig>) => void;
// SiteRuleCard 调用：
onQuickSave={(patch) => onQuickSave(key, patch)}
```

**Step 3: useRulesPageActions 实现 quickSave**

```typescript
const quickSave = (key: string, patch: Partial<WebsiteConfig>) => {
  if (!config) return;
  const websites = config.websites;
  saveConfig({
    ...config,
    websites: { ...websites, [key]: { ...websites[key], ...patch } },
  }, true); // silent
};
```

**Step 4: 连接到 RulesPage**

在 `RulesPage.tsx` 中把 `quickSave` 从 hook 取出，传给 `SiteList`。

**Step 5: Commit**

```bash
git add src/pages/rules/components/SiteRuleCard.tsx src/pages/rules/components/SiteList.tsx src/pages/rules/useRulesPageActions.ts src/pages/rules/RulesPage.tsx
git commit -m "feat(rules): inline quick-edit for domain and release URL"
```

---

## Task 3: 黑名单测试输入

在 `BlacklistTab` 右侧面板（`FilterSettingsCard` 下方）增加 "书名测试" 组件，实时检测输入的书名会不会被黑名单过滤。

**Files:**
- Create: `src/pages/filter/BlacklistTestPanel.tsx`
- Modify: `src/pages/filter/BlacklistTab.tsx`

**Step 1: 创建 BlacklistTestPanel**

```tsx
// src/pages/filter/BlacklistTestPanel.tsx
import { useState, useMemo } from "react";
import { FlaskConical, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/Card";
import type { BlacklistConfig } from "@/types";

interface Props { blacklist: BlacklistConfig; }

function testBlacklist(name: string, bl: BlacklistConfig): { blocked: boolean; reason?: string } {
  if (!bl.enabled) return { blocked: false };

  // Keyword check
  for (const kw of bl.keywords) {
    const haystack = bl.case_insensitive ? name.toLowerCase() : name;
    const needle = bl.case_insensitive ? kw.toLowerCase() : kw;
    if (bl.fuzzy_match) {
      if (haystack.includes(needle)) return { blocked: true, reason: `关键词: "${kw}"` };
    } else {
      if (haystack === needle) return { blocked: true, reason: `关键词(精确): "${kw}"` };
    }
  }

  // Regex check
  if (bl.regex_match) {
    for (const pattern of bl.regex_patterns) {
      try {
        const flags = bl.case_insensitive ? "i" : "";
        if (new RegExp(pattern, flags).test(name)) {
          return { blocked: true, reason: `正则: ${pattern}` };
        }
      } catch {
        // ignore invalid regex
      }
    }
  }

  return { blocked: false };
}

export function BlacklistTestPanel({ blacklist }: Props) {
  const [input, setInput] = useState("");
  const result = useMemo(() => {
    if (!input.trim()) return null;
    return testBlacklist(input.trim(), blacklist);
  }, [input, blacklist]);

  return (
    <Card title="测试书名">
      <div className="flex flex-col gap-2">
        <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          输入书名，实时检查是否会被过滤
        </p>
        <input
          className="w-full text-xs px-3 py-2 rounded-lg border"
          style={{
            background: "var(--color-surface-2)",
            borderColor: result
              ? result.blocked ? "var(--color-danger)" : "var(--color-success)"
              : "var(--color-border)",
            color: "var(--color-text)",
            outline: "none",
          }}
          placeholder="输入书名..."
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        {result && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{
              background: result.blocked ? "var(--color-danger-bg)" : "var(--color-success-bg)",
              color: result.blocked ? "var(--color-danger)" : "var(--color-success)",
            }}
          >
            {result.blocked
              ? <XCircle className="w-3.5 h-3.5 shrink-0" />
              : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            }
            <span>
              {result.blocked ? `会被过滤 — ${result.reason}` : "不会被过滤，可以下载"}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
```

**Step 2: 将 BlacklistTestPanel 加入 BlacklistTab 右侧列**

在 `BlacklistTab.tsx` 的右侧 `div`（`className="flex flex-col gap-3 w-64 shrink-0"`）末尾加入：

```tsx
import { BlacklistTestPanel } from "./BlacklistTestPanel";
// 在 TagPanel 之后：
<BlacklistTestPanel blacklist={bl} />
```

**Step 3: Commit**

```bash
git add src/pages/filter/BlacklistTestPanel.tsx src/pages/filter/BlacklistTab.tsx
git commit -m "feat(filter): add blacklist test input panel"
```

---

## Task 4: 白名单机制

在 `AppConfig.blacklist` 添加 `whitelist: string[]` 字段（前端类型扩展），在 `BlacklistTab` 增加白名单 tab/panel，在 `BlacklistTestPanel` 的测试逻辑中优先检查白名单（命中则不过滤）。

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/pages/filter/WhitelistPanel.tsx`
- Modify: `src/pages/filter/BlacklistTab.tsx`
- Modify: `src/pages/filter/BlacklistTestPanel.tsx`

**Step 1: 扩展 BlacklistConfig 类型**

在 `src/types/index.ts` 的 `BlacklistConfig` 接口中加入：

```typescript
/** Titles that should never be filtered, even if they match a keyword. */
whitelist?: string[];
```

**Step 2: 创建 WhitelistPanel**

与 `KeywordPanel` 结构相同，但更简洁（不需要导入/导出、不需要模糊搜索）：

```tsx
// src/pages/filter/WhitelistPanel.tsx
import { useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { Card } from "@/components/Card";

interface Props {
  whitelist: string[];
  onUpdate: (list: string[]) => void;
}

export function WhitelistPanel({ whitelist, onUpdate }: Props) {
  const [input, setInput] = useState("");

  const add = () => {
    const kw = input.trim();
    if (!kw || whitelist.includes(kw)) return;
    onUpdate([...whitelist, kw]);
    setInput("");
  };

  const remove = (kw: string) => onUpdate(whitelist.filter(w => w !== kw));

  return (
    <Card title="白名单" className="flex flex-col">
      <div className="flex flex-col gap-3">
        <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          白名单中的书名即使匹配关键词也不会被过滤
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 text-xs px-2 py-1.5 rounded-lg border"
            style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text)", outline: "none" }}
            placeholder="书名，按 Enter 添加"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
          />
          <button
            onClick={add}
            className="px-2 py-1.5 rounded-lg text-xs"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {whitelist.length === 0 && (
            <p className="text-xs w-full text-center py-2" style={{ color: "var(--color-text-subtle)" }}>
              还没有白名单条目
            </p>
          )}
          {whitelist.map(kw => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border"
              style={{
                background: "var(--color-success-bg)",
                borderColor: "color-mix(in srgb, var(--color-success) 30%, transparent)",
                color: "var(--color-success)",
              }}
            >
              <ShieldCheck className="w-2.5 h-2.5" />
              {kw}
              <button
                onClick={() => remove(kw)}
                className="ml-0.5 hover:opacity-60"
                style={{ color: "var(--color-success)" }}
              >✕</button>
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
```

**Step 3: 将 WhitelistPanel 加入 BlacklistTab**

在 `BlacklistTab.tsx` 左侧列（`KeywordPanel` 下方）加入：

```tsx
import { WhitelistPanel } from "./WhitelistPanel";
// ...
<WhitelistPanel
  whitelist={bl.whitelist ?? []}
  onUpdate={whitelist => update({ whitelist })}
/>
```

**Step 4: BlacklistTestPanel 优先检查白名单**

在 `testBlacklist` 函数的最开头加：

```typescript
// White list check: if matched, never filter
if (bl.whitelist?.some(w => {
  const h = bl.case_insensitive ? name.toLowerCase() : name;
  const n = bl.case_insensitive ? w.toLowerCase() : w;
  return h === n || h.includes(n);
})) {
  return { blocked: false };
}
```

**Step 5: Commit**

```bash
git add src/types/index.ts src/pages/filter/WhitelistPanel.tsx src/pages/filter/BlacklistTab.tsx src/pages/filter/BlacklistTestPanel.tsx
git commit -m "feat(filter): add whitelist mechanism and test in blacklist tester"
```

---

## Task 5: Calibre 自动检测路径

在 `EbookSection` 的 Calibre 路径 Input 旁加一个"自动检测"按钮，调用后端探测常见安装路径并回填。

**Files:**
- Modify: `src/lib/api/files.ts`
- Modify: `src/pages/settings/sections/EbookSection.tsx`

**Step 1: 添加 API 函数 apiDetectCalibre**

在 `src/lib/api/files.ts` 末尾添加：

```typescript
/**
 * Try to auto-detect the calibre ebook-convert executable path.
 * Returns null if not found.
 */
export async function apiDetectCalibre(): Promise<string | null> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string | null>("detect_calibre");
  }
  // In dev/web mode, try known default paths via a simple heuristic
  const res = await fetch(`${API_BASE}/api/calibre/detect`).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.path ?? null;
}
```

**Step 2: EbookSection 增加"自动检测"按钮**

```tsx
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { apiDetectCalibre } from "@/lib/api";
import { toast } from "sonner";

// 在组件内
const [detecting, setDetecting] = useState(false);

const handleDetectCalibre = async () => {
  setDetecting(true);
  try {
    const path = await apiDetectCalibre();
    if (path) {
      setValue("eb_calibre", path);
      toast.success(`已检测到 Calibre: ${path}`);
    } else {
      toast.error("未找到 Calibre 安装路径，请手动填写");
    }
  } catch {
    toast.error("检测失败");
  } finally {
    setDetecting(false);
  }
};
```

将 Calibre Input 包在一个 flex 容器内并加上按钮：

```tsx
<div className="flex gap-2 items-end">
  <div className="flex-1">
    <Input
      label="Calibre 路径（留空自动检测，MOBI/AZW3 需要）"
      placeholder="C:\Program Files\Calibre2\ebook-convert.exe"
      {...register("eb_calibre")}
    />
  </div>
  <button
    type="button"
    onClick={handleDetectCalibre}
    disabled={detecting}
    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium shrink-0 mb-0"
    style={{
      borderColor: "var(--color-border)",
      color: "var(--color-text-muted)",
      background: "var(--color-surface-2)",
    }}
  >
    {detecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
    自动检测
  </button>
</div>
```

注意：需要从 `useFormContext` 中取出 `setValue`。

**Step 3: Commit**

```bash
git add src/lib/api/files.ts src/pages/settings/sections/EbookSection.tsx
git commit -m "feat(settings): add calibre auto-detect button"
```

---

## Task 6: 配置备份/恢复

在 `SettingsPage` 的 `PageHeader` actions 区增加两个按钮：导出当前配置为 JSON（可读格式）、从 JSON 文件导入覆盖配置。

**Files:**
- Modify: `src/pages/settings/SettingsPage.tsx`

注意：不导出为 YAML（前端没有 js-yaml 依赖，避免新增），改用 JSON。标题提示"配置备份"即可，格式对用户透明。

**Step 1: 导出配置**

利用已有的 `apiSaveTextFile`（`src/lib/api/files.ts`）：

```typescript
import { apiSaveTextFile, apiPickFile } from "@/lib/api";
import { Download, Upload } from "lucide-react";

// 在 SettingsPage 组件内
const handleExport = async () => {
  if (!config) return;
  const content = JSON.stringify(config, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  await apiSaveTextFile(`txtx-config-${date}.json`, content);
};
```

**Step 2: 导入配置**

```typescript
const handleImport = async () => {
  const path = await apiPickFile([{ name: "JSON Config", extensions: ["json"] }]);
  if (!path) return;

  // In Tauri: read file via plugin-fs
  // In browser: open a file input element
  try {
    let content: string;
    if (typeof window.__TAURI_INTERNALS__ !== "undefined") {
      const fs = await new Function('m', 'return import(m)')("@tauri-apps/plugin-fs").catch(() => null);
      if (!fs) { toast.error("文件读取不可用"); return; }
      content = await fs.readTextFile(path);
    } else {
      // fallback: browser file input — apiPickFile returns null in web mode, handled above
      toast.error("Web 模式下暂不支持导入");
      return;
    }
    const parsed = JSON.parse(content) as AppConfig;
    await saveConfig(parsed);
    reset(configToForm(parsed));
    toast.success("配置已导入并应用");
  } catch (e) {
    toast.error(`导入失败: ${String(e)}`);
  }
};
```

由于 `apiPickFile` 在 web 模式返回 null，可以在非 Tauri 时改用隐藏 `<input type="file">` 的方式读取 JSON。

最终实现方案：用一个 `<input type="file" accept=".json" hidden>` + `ref`，在非 Tauri 下点击打开文件对话框：

```tsx
const fileInputRef = useRef<HTMLInputElement>(null);

// import handler for file input
const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const parsed = JSON.parse(ev.target!.result as string) as AppConfig;
      await saveConfig(parsed);
      reset(configToForm(parsed));
      toast.success("配置已导入");
    } catch (err) {
      toast.error(`导入失败: ${String(err)}`);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
};
```

**Step 3: 在 PageHeader actions 加入两个按钮**

在 Save 按钮之前加：

```tsx
<input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileImport} />
<Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} title="从 JSON 导入配置">
  <Upload className="w-3.5 h-3.5" /> 导入
</Button>
<Button type="button" variant="ghost" size="sm" onClick={handleExport} title="将当前配置导出为 JSON">
  <Download className="w-3.5 h-3.5" /> 导出
</Button>
```

**Step 4: Commit**

```bash
git add src/pages/settings/SettingsPage.tsx
git commit -m "feat(settings): config export/import (JSON backup/restore)"
```

---

## Task 7: 本地书架页面

新增 `/bookshelf` 路由，展示 `config.paths.base_dir` 下的 `.txt` 文件列表，显示名称、大小、修改时间，支持打开（`shell.open`）和删除。

**Files:**
- Create: `src/lib/api/bookshelf.ts`
- Create: `src/pages/bookshelf/BookshelfPage.tsx`
- Modify: `src/router.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/types/index.ts`

**Step 1: 类型定义**

在 `src/types/index.ts` 末尾加入：

```typescript
// ─── Bookshelf ────────────────────────────────────────────────────────────────

export interface BookFile {
  name: string;       // filename without extension
  path: string;       // full path
  size: number;       // bytes
  modified: string;   // ISO timestamp
  extension: string;  // "txt" | "epub" etc.
}
```

**Step 2: bookshelf API**

```typescript
// src/lib/api/bookshelf.ts
import type { BookFile } from "@/types";
import { IS_TAURI, API_BASE } from "./constants";

export async function apiListBooks(dir: string): Promise<BookFile[]> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<BookFile[]>("list_books", { dir });
  }
  const res = await fetch(`${API_BASE}/api/books?dir=${encodeURIComponent(dir)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiDeleteBook(path: string): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("delete_book", { path });
  }
  const res = await fetch(`${API_BASE}/api/books`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function apiOpenBook(path: string): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("open_book", { path });
  }
  // Web mode: not supported
}
```

在 `src/lib/api/index.ts` 中 export：

```typescript
export * from "./bookshelf";
```

**Step 3: BookshelfPage**

完整页面组件，使用 `useQuery` 加载书目，支持搜索、排序（名称/大小/时间）、打开/删除：

```tsx
// src/pages/bookshelf/BookshelfPage.tsx
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Search, ArrowUpDown, FolderOpen, Trash2, RefreshCw, File } from "lucide-react";
import { toast } from "sonner";
import { useConfigStore } from "@/store/configStore";
import { apiListBooks, apiDeleteBook, apiOpenBook } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import type { BookFile } from "@/types";

type SortKey = "name" | "size" | "modified";
type SortDir = "asc" | "desc";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

export function BookshelfPage() {
  const { config } = useConfigStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("modified");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const baseDir = config?.paths.base_dir ?? "";

  const { data: books = [], isLoading, error, refetch } = useQuery({
    queryKey: ["books", baseDir],
    queryFn: () => apiListBooks(baseDir),
    enabled: !!baseDir,
  });

  const deleteMutation = useMutation({
    mutationFn: apiDeleteBook,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books"] });
      toast.success("已删除");
      setConfirmDelete(null);
    },
    onError: (e) => toast.error(String(e)),
  });

  const filtered = useMemo(() => {
    let list = [...books];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b => b.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, "zh");
      if (sortKey === "size") cmp = a.size - b.size;
      if (sortKey === "modified") cmp = a.modified.localeCompare(b.modified);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [books, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className="flex items-center gap-1 text-xs font-medium"
      style={{ color: sortKey === k ? "var(--color-accent)" : "var(--color-text-muted)" }}
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">
      <PageHeader
        title="本地书架"
        subtitle={`${filtered.length} 本 / ${books.length} 本`}
        actions={
          <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> 刷新
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--color-text-muted)" }} />
          <input
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border"
            style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text)", outline: "none" }}
            placeholder="搜索书名..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>排序：</span>
          <SortBtn k="name" label="名称" />
          <SortBtn k="size" label="大小" />
          <SortBtn k="modified" label="时间" />
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          {String(error)}
        </div>
      )}

      {/* Book list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>加载中...</p>
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--color-accent-muted)", border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)" }}
            >
              <BookOpen className="w-8 h-8" style={{ color: "var(--color-accent)" }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                {search ? "没有匹配的书目" : "书架是空的"}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                {search ? "" : `下载目录: ${baseDir || "未设置"}`}
              </p>
            </div>
          </div>
        )}
        {filtered.map(book => (
          <div
            key={book.path}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "var(--color-accent-muted)", border: "1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)" }}
            >
              <File className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                {book.name}
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {formatSize(book.size)} · {formatDate(book.modified)} · {book.extension.toUpperCase()}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => apiOpenBook(book.path).catch(e => toast.error(String(e)))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)", background: "var(--color-surface-2)" }}
                title="打开文件"
              >
                <FolderOpen className="w-3.5 h-3.5" /> 打开
              </button>
              {confirmDelete === book.path ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>确认？</span>
                  <button
                    onClick={() => deleteMutation.mutate(book.path)}
                    className="px-2 py-1 rounded text-xs"
                    style={{ background: "var(--color-danger)", color: "#fff" }}
                  >删除</button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-2 py-1 rounded text-xs border"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
                  >取消</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(book.path)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                  style={{ color: "var(--color-danger)" }}
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 4: 注册路由**

在 `src/router.tsx` 中：

```typescript
// ROUTES 常量加入：
bookshelf: "/bookshelf",

// 懒加载：
const BookshelfPage = lazy(() => import("@/pages/bookshelf/BookshelfPage").then(m => ({ default: m.BookshelfPage })));

// routeConfig 加入：
{ path: "bookshelf", element: wrap(BookshelfPage) },
```

**Step 5: Sidebar 加入书架入口**

```typescript
import { Library } from "lucide-react";
// navItems 中加入：
{ to: "/bookshelf", icon: Library, label: "本地书架" },
```

**Step 6: api/index.ts 导出**

```typescript
export * from "./bookshelf";
```

**Step 7: Commit**

```bash
git add src/lib/api/bookshelf.ts src/lib/api/index.ts src/pages/bookshelf/BookshelfPage.tsx src/router.tsx src/components/Sidebar.tsx src/types/index.ts
git commit -m "feat: add local bookshelf page (/bookshelf)"
```

---

## Task 8: 任务管理 — 按站点筛选 + 失败书目导出

在 `TaskDetailPanel` 的 `ScanPreviewPanel` 中增加"按站点筛选"下拉，并在 `DoneView` / `FailedView` 中加"导出失败书目"按钮。

**Files:**
- Modify: `src/pages/tasks/TaskDetailPanel.tsx`

**Step 1: ScanPreviewPanel 增加站点筛选**

在 `ScanPreviewPanel` 组件内，从 `items` 提取站点列表，加一个 `siteFilter` state：

```typescript
const [siteFilter, setSiteFilter] = useState<string>("");
const sites = useMemo(() => [...new Set(items.map(i => i.site))].sort(), [items]);
const visible = useMemo(() =>
  siteFilter ? items.filter(i => i.site === siteFilter) : items,
  [items, siteFilter]
);
```

在顶部 toolbar 加站点筛选下拉（`<select>`）：

```tsx
{sites.length > 1 && (
  <select
    value={siteFilter}
    onChange={e => setSiteFilter(e.target.value)}
    className="text-xs px-2 py-1 rounded-lg border"
    style={{
      background: "var(--color-surface-2)",
      borderColor: "var(--color-border)",
      color: "var(--color-text-muted)",
    }}
  >
    <option value="">全部站点</option>
    {sites.map(s => <option key={s} value={s}>{s}</option>)}
  </select>
)}
```

将列表渲染从 `items.map(...)` 改为 `visible.map(...)`。

**Step 2: DoneView 增加失败书目导出**

在 `DoneView` 中，从 `task.scan_items` 过滤出下载失败的（暂时没有 per-item 失败状态，用 `error_count > 0` 显示导出按钮，实际导出任务 label + 错误统计）：

实际可导出内容：用 task logs 中 level="error" 的消息。

由于 `DoneView` 没有直接访问 logs，简单方案：导出 `task.scan_items` 全部（扫描列表）的 CSV，供用户自己核对。更有价值的实现：在 `TaskDetailPanel` 处解析 logs，提取包含书名的错误行。

最简可行实现：`DoneView` 接受 `failedItems: string[]` prop（从 logs 中 level=error 提取的 message 列表），导出为 txt：

```typescript
// 在 TaskDetailPanel 中 compute failedMessages
const failedMessages = logs
  .filter(l => l.level === "error")
  .map(l => l.message);
```

在 `DoneView` 组件 props 加 `failedMessages: string[]`，在 "重试失败" 按钮旁加 "导出失败日志" 按钮：

```tsx
{failedMessages.length > 0 && (
  <button
    onClick={() => {
      const content = failedMessages.join("\n");
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `failed-${task.id.slice(0, 8)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs"
    style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)", background: "var(--color-surface-2)" }}
  >
    <Download className="w-3.5 h-3.5" /> 导出失败日志
  </button>
)}
```

**Step 3: Commit**

```bash
git add src/pages/tasks/TaskDetailPanel.tsx
git commit -m "feat(tasks): site filter in scan preview + export failed logs in done view"
```

---

## Task 9: 扫描结果排序

在 `ScanPreviewPanel` 的站点筛选旁加排序控件（按站点/按日期/按名称）。

**Files:**
- Modify: `src/pages/tasks/TaskDetailPanel.tsx`

**Step 1: 增加 sortKey 状态**

```typescript
type ScanSortKey = "name" | "site" | "date";
const [scanSort, setScanSort] = useState<ScanSortKey>("date");
```

在站点筛选之后加排序 `<select>`：

```tsx
<select
  value={scanSort}
  onChange={e => setScanSort(e.target.value as ScanSortKey)}
  className="text-xs px-2 py-1 rounded-lg border"
  style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
>
  <option value="date">按日期</option>
  <option value="name">按名称</option>
  <option value="site">按站点</option>
</select>
```

将 `visible` 增加排序逻辑：

```typescript
const sorted = useMemo(() => {
  const list = [...visible];
  if (scanSort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "zh"));
  if (scanSort === "site") list.sort((a, b) => a.site.localeCompare(b.site));
  if (scanSort === "date") list.sort((a, b) => b.date.localeCompare(a.date));
  return list;
}, [visible, scanSort]);
// 渲染用 sorted.map(...)
```

**Step 2: Commit**

```bash
git add src/pages/tasks/TaskDetailPanel.tsx
git commit -m "feat(tasks): sortable scan preview (name/site/date)"
```

---

## Task 10: 定时/每日自动扫描

在 `TaskListPanel` 的新建菜单中加"定时扫描"开关，使用前端 `setInterval`（每天同一时间）在应用运行时触发 `createBatchTask`。配置持久化到 `localStorage`。

**Files:**
- Create: `src/store/schedulerStore.ts`
- Modify: `src/pages/tasks/TaskListPanel.tsx`
- Modify: `src/layouts/RootLayout.tsx`

**Step 1: schedulerStore**

```typescript
// src/store/schedulerStore.ts
import { create } from "zustand";

interface SchedulerState {
  enabled: boolean;
  hour: number;   // 0-23, default 6
  lastRun: string | null; // ISO date "YYYY-MM-DD"
  toggle: () => void;
  setHour: (h: number) => void;
  markRan: () => void;
}

const STORAGE_KEY = "txtx-scheduler";

function load(): Pick<SchedulerState, "enabled" | "hour" | "lastRun"> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { enabled: false, hour: 6, lastRun: null };
  } catch { return { enabled: false, hour: 6, lastRun: null }; }
}

function save(s: Pick<SchedulerState, "enabled" | "hour" | "lastRun">) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

const initial = load();

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
  ...initial,
  toggle: () => {
    const next = !get().enabled;
    set({ enabled: next });
    save({ enabled: next, hour: get().hour, lastRun: get().lastRun });
  },
  setHour: (hour) => {
    set({ hour });
    save({ enabled: get().enabled, hour, lastRun: get().lastRun });
  },
  markRan: () => {
    const today = new Date().toISOString().slice(0, 10);
    set({ lastRun: today });
    save({ enabled: get().enabled, hour: get().hour, lastRun: today });
  },
}));
```

**Step 2: Scheduler hook in RootLayout**

在 `RootLayout.tsx` 中加 `useEffect` 轮询（每分钟检查一次）：

```typescript
import { useSchedulerStore } from "@/store/schedulerStore";
import { useTaskStore } from "@/store/taskStore";

// 在 RootLayout 内
const { enabled, hour, lastRun, markRan } = useSchedulerStore();
const { createBatchTask } = useTaskStore();

useEffect(() => {
  if (!enabled) return;
  const check = () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (now.getHours() === hour && lastRun !== today) {
      markRan();
      createBatchTask().catch(console.error);
    }
  };
  check(); // check immediately
  const id = setInterval(check, 60_000); // every minute
  return () => clearInterval(id);
}, [enabled, hour, lastRun, markRan, createBatchTask]);
```

**Step 3: 在 TaskListPanel 新建菜单中加定时配置 UI**

在 `DownloadModeSelector` 上方加定时开关：

```tsx
import { useSchedulerStore } from "@/store/schedulerStore";
import { Clock } from "lucide-react";

// 组件内
const { enabled: schedEnabled, hour: schedHour, toggle: schedToggle, setHour: schedSetHour } = useSchedulerStore();

// UI
<div className="flex flex-col gap-1">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-1.5">
      <Clock className="w-3.5 h-3.5" style={{ color: schedEnabled ? "var(--color-accent)" : "var(--color-text-muted)" }} />
      <span className="text-[10px] font-medium" style={{ color: "var(--color-text-muted)" }}>每日自动扫描</span>
    </div>
    <button
      onClick={schedToggle}
      className="w-8 h-4 rounded-full transition-colors relative"
      style={{ background: schedEnabled ? "var(--color-accent)" : "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
    >
      <span
        className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
        style={{ left: schedEnabled ? "calc(100% - 14px)" : "2px" }}
      />
    </button>
  </div>
  {schedEnabled && (
    <div className="flex items-center gap-2 pl-5">
      <span className="text-[10px]" style={{ color: "var(--color-text-subtle)" }}>触发时间</span>
      <select
        value={schedHour}
        onChange={e => schedSetHour(Number(e.target.value))}
        className="text-xs px-1.5 py-0.5 rounded border"
        style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
        ))}
      </select>
    </div>
  )}
</div>
<div className="h-px" style={{ background: "var(--color-border)" }} />
```

**Step 4: Commit**

```bash
git add src/store/schedulerStore.ts src/pages/tasks/TaskListPanel.tsx src/layouts/RootLayout.tsx
git commit -m "feat(tasks): daily auto-scan scheduler with configurable hour"
```

---

## Task 11: 任务完成后打开保存目录

在 `DoneView` 中加"打开保存目录"按钮，调用已有的 `apiOpenOutputDir`。

**Files:**
- Modify: `src/pages/tasks/TaskDetailPanel.tsx`

**Step 1: 在 DoneView 增加按钮**

`DoneView` 已有 props：`task`, `onRetry`。再加 `onOpenDir?: () => void`。

在 "下载完成" 标题行右侧，"重试失败"按钮旁加：

```tsx
<Button variant="secondary" size="sm" onClick={onOpenDir} title="打开保存目录">
  <FolderOpen className="w-3.5 h-3.5" /> 打开目录
</Button>
```

在 `TaskDetailPanel` 中：

```typescript
import { apiOpenOutputDir } from "@/lib/api";

// DoneView 调用时传入：
<DoneView
  task={task}
  onRetry={handleRetry}
  failedMessages={failedMessages}
  onOpenDir={() => apiOpenOutputDir().catch(e => toast.error(String(e)))}
/>
```

**Step 2: 从 Task 8 连接 failedMessages**

在 `TaskDetailPanel` 中计算 `failedMessages`：

```typescript
import { toast } from "sonner";
// ...
const failedMessages = logs.filter(l => l.level === "error").map(l => l.message);
```

将这个传给 `DoneView`（Task 8 已规划，这里确保连接完整）。

**Step 3: Commit**

```bash
git add src/pages/tasks/TaskDetailPanel.tsx
git commit -m "feat(tasks): open output directory button in done view"
```

---

## 验证清单

每个任务完成后运行：

```bash
pnpm run build 2>&1 | tail -20
```

确认零 TS 错误、零构建警告后提交。

## 注意事项

1. **Tauri 后端 invoke**：`detect_calibre`、`list_books`、`delete_book`、`open_book` 这些新增 invoke 命令需要 Rust 端实现。在 dev/HTTP 模式下对应的 REST 接口也需后端支持。由于本计划只负责前端，这些 API 函数先写好，在后端没实现前 dev 模式下会报错，属预期行为，可用 `.catch(() => [])` 降级。

2. **Content-Clean 预览对比**：`ContentCleanTestPanel` 已有完整的预览对比功能（清洗前 vs 后 diff 视图），只是没有在 `ContentCleanTab` 中显示。检查它是否已渲染——如果已渲染，此项无需额外工作。

3. **白名单持久化**：`whitelist` 字段保存到 `config.blacklist.whitelist`，随 `saveConfig` 写入后端 YAML。后端 Rust 端需要对应字段，否则会被忽略。前端先实现，后端兼容更新可后续进行。

# 前端大组件拆分 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将三个大型前端组件拆分为更小的子组件和自定义 Hook，提升可维护性和可读性。

**Architecture:** 每个文件提取独立 Hook 封装状态与业务逻辑，视图层拆出纯展示子组件，父组件仅做组合。子组件和 Hook 与父文件同目录，不新建额外目录（保持现有项目惯例）。

**Tech Stack:** React 18, TypeScript, react-hook-form (useFieldArray), @tanstack/react-query, recharts

---

## Task 1：AdPatternPanel — 提取 `useAdPatterns` Hook

**目标：** 把 `AdPatternPanel` 里的所有状态（`newPattern`, `bulkMode`, `bulkText`）和操作（`addPattern`, `removePattern`, `handleBulkAdd`, `handleImport`, `handleExport`）提取到专属 Hook。

**Files:**
- Create: `src/pages/filter/useAdPatterns.ts`
- Modify: `src/pages/filter/AdPatternPanel.tsx`

**Step 1: 创建 `useAdPatterns.ts`**

```ts
// src/pages/filter/useAdPatterns.ts
import { useMemo, useRef, useState } from "react";

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

interface UseAdPatternsOptions {
  patterns: string[];
  onUpdate: (patterns: string[]) => void;
}

export function useAdPatterns({ patterns, onUpdate }: UseAdPatternsOptions) {
  const [newPattern, setNewPattern] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValid = newPattern.trim() === "" || isValidRegex(newPattern.trim());

  const addPattern = () => {
    const p = newPattern.trim();
    if (!p || patterns.includes(p) || !isValidRegex(p)) return;
    onUpdate([...patterns, p]);
    setNewPattern("");
  };

  const removePattern = (p: string) => {
    onUpdate(patterns.filter((x) => x !== p));
  };

  const handleBulkAdd = () => {
    const lines = bulkText
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter((l) => l && isValidRegex(l));
    if (lines.length === 0) return;
    onUpdate([...new Set([...patterns, ...lines])]);
    setBulkText("");
    setBulkMode(false);
  };

  const bulkValidCount = useMemo(
    () =>
      bulkText
        .split(/[\r\n]+/)
        .map((l) => l.trim())
        .filter((l) => l && isValidRegex(l)).length,
    [bulkText],
  );

  const bulkInvalidCount = useMemo(
    () =>
      bulkText
        .split(/[\r\n]+/)
        .map((l) => l.trim())
        .filter((l) => l && !isValidRegex(l)).length,
    [bulkText],
  );

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const newPatterns = text
        .split(/[\r\n]+/)
        .map((l) => l.trim())
        .filter((l) => l && isValidRegex(l));
      onUpdate([...new Set([...patterns, ...newPatterns])]);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExport = () => {
    const blob = new Blob([patterns.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ad_patterns.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    newPattern, setNewPattern,
    bulkMode, setBulkMode,
    bulkText, setBulkText,
    fileInputRef,
    isValid,
    bulkValidCount,
    bulkInvalidCount,
    addPattern,
    removePattern,
    handleBulkAdd,
    handleImport,
    handleExport,
  };
}

export { isValidRegex };
```

**Step 2: 更新 `AdPatternPanel.tsx` 使用 Hook**

删去原有所有 state/ref/函数，改为 `const { ... } = useAdPatterns({ patterns, onUpdate })` 调用，同时删除文件内内联的 `isValidRegex`（已移至 Hook 文件）并从 Hook 文件 import。

```tsx
// 顶部 import 改为：
import { useAdPatterns, isValidRegex } from "./useAdPatterns";

// 组件体开头替换为：
const {
  newPattern, setNewPattern,
  bulkMode, setBulkMode,
  bulkText, setBulkText,
  fileInputRef,
  isValid,
  bulkValidCount,
  bulkInvalidCount,
  addPattern,
  removePattern,
  handleBulkAdd,
  handleImport,
  handleExport,
} = useAdPatterns({ patterns, onUpdate });
```

JSX 部分不变。

**Step 3: 验证编译**

```
pnpm tsc --noEmit
```
预期：无新错误。

---

## Task 2：AdPatternPanel — 提取 `BulkAddPanel` 子组件

**目标：** 把批量添加区域（`{bulkMode && (...)}` 块）拆成独立组件。

**Files:**
- Create: `src/pages/filter/BulkAddPanel.tsx`
- Modify: `src/pages/filter/AdPatternPanel.tsx`

**Step 1: 创建 `BulkAddPanel.tsx`**

```tsx
// src/pages/filter/BulkAddPanel.tsx
import { Plus, X } from "lucide-react";
import { inputFocusHandlers } from "@/pages/blacklist/blacklistUtils";

interface BulkAddPanelProps {
  bulkText: string;
  bulkValidCount: number;
  bulkInvalidCount: number;
  onTextChange: (v: string) => void;
  onAdd: () => void;
  onCancel: () => void;
}

export function BulkAddPanel({
  bulkText,
  bulkValidCount,
  bulkInvalidCount,
  onTextChange,
  onAdd,
  onCancel,
}: BulkAddPanelProps) {
  return (
    <div
      className="mb-3 flex flex-col gap-2 rounded-xl border p-3"
      style={{ background: "var(--color-surface-1)", borderColor: "var(--color-accent)" }}
    >
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        每行一条正则表达式，无效正则会自动跳过
      </p>
      <textarea
        rows={5}
        className="w-full resize-y rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none"
        style={{
          background: "var(--color-surface-2)",
          borderColor: "var(--color-border)",
          color: "var(--color-text)",
        }}
        placeholder={"广告文字.*\n\\[.*?\\]\n第.{1,3}章"}
        value={bulkText}
        onChange={(e) => onTextChange(e.target.value)}
        {...inputFocusHandlers}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {bulkValidCount} 条有效
          {bulkInvalidCount > 0 && (
            <span style={{ color: "var(--color-danger)" }}>
              {" "}· {bulkInvalidCount} 条无效将跳过
            </span>
          )}
        </span>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
          >
            <X className="h-3 w-3" /> 取消
          </button>
          <button
            onClick={onAdd}
            disabled={bulkValidCount === 0}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            <Plus className="h-3 w-3" /> 批量添加
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: 更新 `AdPatternPanel.tsx`**

删除内联的批量添加 JSX，替换为：
```tsx
import { BulkAddPanel } from "./BulkAddPanel";

// JSX 中 bulkMode 区域替换为：
{bulkMode && (
  <BulkAddPanel
    bulkText={bulkText}
    bulkValidCount={bulkValidCount}
    bulkInvalidCount={bulkInvalidCount}
    onTextChange={setBulkText}
    onAdd={handleBulkAdd}
    onCancel={() => { setBulkMode(false); setBulkText(""); }}
  />
)}
```

**Step 3: 验证编译**

```
pnpm tsc --noEmit
```

---

## Task 3：AdPatternPanel — 提取 `PatternListItem` 子组件

**目标：** 把列表中每条 pattern 的行渲染（含校验图标和删除按钮）拆为独立组件。

**Files:**
- Create: `src/pages/filter/PatternListItem.tsx`
- Modify: `src/pages/filter/AdPatternPanel.tsx`

**Step 1: 创建 `PatternListItem.tsx`**

```tsx
// src/pages/filter/PatternListItem.tsx
import { AlertCircle, CheckCircle2, Trash2 } from "lucide-react";

interface PatternListItemProps {
  pattern: string;
  isValid: boolean;
  onRemove: (p: string) => void;
}

export function PatternListItem({ pattern, isValid, onRemove }: PatternListItemProps) {
  return (
    <div
      className="group flex items-center gap-2 rounded-lg border px-3 py-1.5"
      style={{
        background: "var(--color-surface-2)",
        borderColor: isValid
          ? "var(--color-border)"
          : "color-mix(in srgb, var(--color-danger) 40%, transparent)",
      }}
    >
      {isValid ? (
        <CheckCircle2
          className="h-3 w-3 shrink-0 opacity-40"
          style={{ color: "var(--color-success, #22c55e)" }}
        />
      ) : (
        <AlertCircle className="h-3 w-3 shrink-0" style={{ color: "var(--color-danger)" }} />
      )}
      <code className="flex-1 truncate font-mono text-xs" style={{ color: "var(--color-accent)" }}>
        {pattern}
      </code>
      <button
        onClick={() => onRemove(pattern)}
        className="cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: "var(--color-text-muted)" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
```

**Step 2: 更新 `AdPatternPanel.tsx`**

替换 `patterns.map(...)` 渲染块：
```tsx
import { PatternListItem } from "./PatternListItem";

// 列表区域替换为：
{patterns.map((p) => (
  <PatternListItem
    key={p}
    pattern={p}
    isValid={isValidRegex(p)}
    onRemove={removePattern}
  />
))}
```

同时删除 `useMemo` 中的 `valid/invalid` 计算（已无用）。

**Step 3: 验证编译**

```
pnpm tsc --noEmit
```

---

## Task 4：HistoryStatsPanel — 提取 `useHistoryStats` Hook

**目标：** 把数据获取逻辑和动画 Effect 提取到 Hook，组件只做渲染。

**Files:**
- Create: `src/pages/history/useHistoryStats.ts`
- Modify: `src/pages/history/HistoryStatsPanel.tsx`

**Step 1: 创建 `useHistoryStats.ts`**

```ts
// src/pages/history/useHistoryStats.ts
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { animateFadeInUp } from "@/lib/animations";
import { apiGetHistoryStats } from "@/lib/api";

const PIE_COLORS = [
  "var(--color-accent)",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

export function useHistoryStats(days = 30) {
  const { data, isLoading } = useQuery({
    queryKey: ["history-stats", days],
    queryFn: () => apiGetHistoryStats(days),
  });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && containerRef.current) {
      animateFadeInUp(containerRef.current, 0);
    }
  }, [isLoading]);

  const daily = data?.daily ?? [];
  const sites = (data?.sites ?? []).map((s, i) => ({
    ...s,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }));

  return { isLoading, daily, sites, containerRef };
}
```

**Step 2: 更新 `HistoryStatsPanel.tsx`**

```tsx
import { useHistoryStats } from "./useHistoryStats";

export function HistoryStatsPanel({ onClose }: HistoryStatsPanelProps) {
  const { isLoading, daily, sites, containerRef } = useHistoryStats(30);

  if (isLoading) { /* 保持不变 */ }

  return (
    <div ref={containerRef} className="mb-4 grid grid-cols-2 gap-4" style={{ opacity: 0 }}>
      {/* 图表 JSX 不变，但 daily/sites 来自 hook */}
    </div>
  );
}
```

删除顶部 `useEffect`, `useRef`, `useQuery`, `animateFadeInUp`, `apiGetHistoryStats` 的 import（已移入 hook），删除 `PIE_COLORS` 常量。

**Step 3: 验证编译**

```
pnpm tsc --noEmit
```

---

## Task 5：HistoryStatsPanel — 提取 `DailyTrendChart` 和 `SiteDistributionChart`

**目标：** 把两个图表的 JSX + Tooltip formatter 内联逻辑各自提取为子组件。

**Files:**
- Create: `src/pages/history/DailyTrendChart.tsx`
- Create: `src/pages/history/SiteDistributionChart.tsx`
- Modify: `src/pages/history/HistoryStatsPanel.tsx`

**Step 1: 创建 `DailyTrendChart.tsx`**

```tsx
// src/pages/history/DailyTrendChart.tsx
import {
  Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

import { Card } from "@/components/Card";

interface DailyEntry {
  date: string;
  success: number;
  error: number;
}

interface DailyTrendChartProps {
  data: DailyEntry[];
  onClose: () => void;
}

const TOOLTIP_STYLE = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

function formatDailyTooltip(v: ValueType | undefined, name: NameType | undefined) {
  return [v ?? 0, name === "success" ? "成功" : "失败"] as [ValueType, NameType];
}

export function DailyTrendChart({ data, onClose }: DailyTrendChartProps) {
  return (
    <Card
      title="近 30 天下载趋势"
      actions={
        <button onClick={onClose} className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          收起
        </button>
      }
    >
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
              tickFormatter={(d) => d.slice(5)}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={formatDailyTooltip} />
            <Bar dataKey="success" fill="var(--color-success)" radius={[3, 3, 0, 0]} maxBarSize={20} />
            <Bar dataKey="error" fill="var(--color-danger)" radius={[3, 3, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
```

**Step 2: 创建 `SiteDistributionChart.tsx`**

```tsx
// src/pages/history/SiteDistributionChart.tsx
import { Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

import { Card } from "@/components/Card";

interface SiteEntry {
  site: string;
  count: number;
  fill: string;
}

interface SiteDistributionChartProps {
  data: SiteEntry[];
}

const TOOLTIP_STYLE = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

function stripProtocol(url: string) {
  return url.replace(/^https?:\/\//, "");
}

function formatSiteTooltip(v: ValueType | undefined, name: NameType | undefined) {
  return [v ?? 0, stripProtocol(String(name ?? ""))] as [ValueType, NameType];
}

export function SiteDistributionChart({ data }: SiteDistributionChartProps) {
  return (
    <Card title="站点分布（成功）">
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="site"
              cx="40%"
              cy="50%"
              outerRadius={60}
              fontSize={10}
            />
            <Legend
              formatter={(v: string) => stripProtocol(v).slice(0, 12)}
              wrapperStyle={{ fontSize: 10, color: "var(--color-text-muted)" }}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={formatSiteTooltip} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
```

**Step 3: 更新 `HistoryStatsPanel.tsx`**

```tsx
import { DailyTrendChart } from "./DailyTrendChart";
import { SiteDistributionChart } from "./SiteDistributionChart";

// JSX 替换为：
return (
  <div ref={containerRef} className="mb-4 grid grid-cols-2 gap-4" style={{ opacity: 0 }}>
    <DailyTrendChart data={daily} onClose={onClose} />
    <SiteDistributionChart data={sites} />
  </div>
);
```

删除所有 recharts import（已移入子组件）。

**Step 4: 验证编译**

```
pnpm tsc --noEmit
```

---

## Task 6：RateLimitRulesSection — 提取 `RateLimitRuleCard` 子组件

**目标：** 把 `fields.map(...)` 内的整个规则卡（含展开/折叠头部和展开后的表单体）提取为独立组件。

**Files:**
- Create: `src/pages/settings/sections/RateLimitRuleCard.tsx`
- Modify: `src/pages/settings/sections/RateLimitRulesSection.tsx`

**Step 1: 创建 `RateLimitRuleCard.tsx`**

```tsx
// src/pages/settings/sections/RateLimitRuleCard.tsx
import { ChevronDown, ChevronUp, ShieldCheck, Trash2 } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { Input } from "@/components/Input";

import { FieldError } from "../SettingsFields";
import type { SettingsForm } from "../settingsSchema";

interface RateLimitRuleCardProps {
  index: number;
  fieldId: string;
  isOpen: boolean;
  onToggle: () => void;
  onRemove: () => void;
  /** 来自 rulesErrors?.[index] */
  errors?: Record<string, { message?: string }>;
}

export function RateLimitRuleCard({
  index,
  isOpen,
  onToggle,
  onRemove,
  errors: errs,
}: RateLimitRuleCardProps) {
  const { register, watch } = useFormContext<SettingsForm>();
  const ruleName = watch(`rate_limit_rules.${index}.name`) as string | undefined;
  const ruleDomains = watch(`rate_limit_rules.${index}.domains`) as string | undefined;

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* Header */}
      <div
        className="flex cursor-pointer items-center gap-2 px-3 py-2 select-none"
        style={{ background: "var(--color-surface-1)" }}
        onClick={onToggle}
      >
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
        <span className="flex-1 truncate text-xs font-medium" style={{ color: "var(--color-text)" }}>
          {ruleName || `规则 ${index + 1}`}
        </span>
        <span className="max-w-48 truncate text-xs" style={{ color: "var(--color-text-subtle)" }}>
          {ruleDomains
            ? ruleDomains.split("\n").filter(Boolean).slice(0, 3).join(", ")
            : "（无域名）"}
        </span>
        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="shrink-0 rounded-md p-1 hover:opacity-70"
          style={{ color: "var(--color-danger)" }}
          title="删除规则"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expanded body */}
      {isOpen && (
        <div
          className="flex flex-col gap-3 border-t p-3"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              规则名称
            </label>
            <input
              {...register(`rate_limit_rules.${index}.name`)}
              className="w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              placeholder="如：TTKS 系站点"
            />
            <FieldError msg={errs?.name?.message} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              匹配域名（每行一条，URL 包含任意一条即命中）
            </label>
            <textarea
              {...register(`rate_limit_rules.${index}.domains`)}
              rows={3}
              className="w-full resize-y rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              placeholder={"ttks.tw\nttks.cc\nttks.me"}
            />
            <FieldError msg={errs?.domains?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="最小延迟（毫秒）"
                type="number"
                {...register(`rate_limit_rules.${index}.delay_min_ms`)}
              />
              <FieldError msg={errs?.delay_min_ms?.message} />
            </div>
            <div>
              <Input
                label="最大延迟（毫秒）"
                type="number"
                {...register(`rate_limit_rules.${index}.delay_max_ms`)}
              />
              <FieldError msg={errs?.delay_max_ms?.message} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Input
              label="每秒最大请求数（0 = 使用随机延迟）"
              type="number"
              {...register(`rate_limit_rules.${index}.requests_per_second`)}
            />
            <FieldError msg={errs?.requests_per_second?.message} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              User-Agent 池（每行一条，随机轮换；空 = 使用全局 UA）
            </label>
            <textarea
              {...register(`rate_limit_rules.${index}.ua_pool`)}
              rows={4}
              className="w-full resize-y rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."
            />
            <FieldError msg={errs?.ua_pool?.message} />
          </div>

          <label
            className="flex cursor-pointer items-center gap-2 text-xs"
            style={{ color: "var(--color-text)" }}
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-(--color-accent)"
              {...register(`rate_limit_rules.${index}.stealth`)}
            />
            <span>启用 Stealth TLS 指纹（绕过 JA3/JA4 反爬，需 stealth feature 编译）</span>
          </label>
        </div>
      )}
    </div>
  );
}
```

**Step 2: 更新 `RateLimitRulesSection.tsx`**

```tsx
import { RateLimitRuleCard } from "./RateLimitRuleCard";

// fields.map(...) 替换为：
{fields.map((field, i) => (
  <RateLimitRuleCard
    key={field.id}
    index={i}
    fieldId={field.id}
    isOpen={!!expanded[i]}
    onToggle={() => toggle(i)}
    onRemove={() => remove(i)}
    errors={rulesErrors?.[i]}
  />
))}
```

删除不再使用的 `ChevronDown`, `ChevronUp`, `ShieldCheck`, `Trash2`, `Input`, `FieldError` import（已移入子组件）。

**Step 3: 验证编译**

```
pnpm tsc --noEmit
```

---

## Task 7：最终整体编译验证

**Step 1: 全量类型检查**

```
pnpm tsc --noEmit
```
预期：无错误。

**Step 2: （可选）开发服务器快速冒烟**

确认应用正常启动、三个页面均可正常使用（广告过滤规则添加/删除、历史统计图表展示、限速规则展开编辑）。

**Step 3: Commit**

```bash
git add src/pages/filter/useAdPatterns.ts src/pages/filter/BulkAddPanel.tsx src/pages/filter/PatternListItem.tsx src/pages/filter/AdPatternPanel.tsx
git add src/pages/history/useHistoryStats.ts src/pages/history/DailyTrendChart.tsx src/pages/history/SiteDistributionChart.tsx src/pages/history/HistoryStatsPanel.tsx
git add src/pages/settings/sections/RateLimitRuleCard.tsx src/pages/settings/sections/RateLimitRulesSection.tsx
git commit -m "refactor: split large components into hooks and sub-components"
```

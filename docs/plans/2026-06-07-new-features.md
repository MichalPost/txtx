# 新功能实现计划

**Goal:** 实现以下 7 项功能增强，覆盖下载体验、内容处理、主题定制和规则向导扩展。

**Architecture:** 全部复用现有设计系统（CSS vars + Tailwind v4）、Zustand、react-hook-form、sonner toast，不新增外部依赖。后端 Rust 改动最小化，优先纯前端实现，后端新增 Tauri command 时附带 dev-server 的 HTTP fallback。

**Tech Stack:** React 19 + TypeScript + Zustand + Tailwind v4 + lucide-react + sonner + Tauri (conditional)

---

## 任务概览

| # | 功能 | 范围 |
|---|------|------|
| 1 | 断点续传 + 智能重试（进度持久化可视化） | 前端 + 后端已有逻辑暴露 |
| 2 | 并发任务数全局设置（同时运行任务上限） | 前端设置 + 后端 TaskManager |
| 3 | 下载前站点预检 | 前端新组件 |
| 4 | 章节质量评分（字数异常检测） | 前端新组件，读取 task 数据 |
| 5 | 自定义后处理脚本 | 前端设置 + 后端 Tauri command |
| 6 | 文本工具箱扩展（ConverterPage 增强） | 前端改造 |
| 7 | 自定义主题编辑器 | 前端新页面 + themeStore 扩展 |
| 8 | 规则向导：简介规则字段 | 前端 WizardData + WizardStep5 + Save |

---

## Task 1: 断点续传可视化

**背景：** 后端已有完整的断点续传机制（`download_queue.json` + 章节级 temp 文件跳过）。前端目前只展示任务进度条，没有告知用户"正在续传"还是"全新开始"，也没有办法主动清除卡住的队列。

**目标：** 在任务列表里，对处于续传状态的任务标注"续传"角标；在下载页加一个"清除断点队列"快捷按钮（现有 `apiClearQueue` 已支持）；在 DownloadProgress 里展示"已跳过（已下载）章节数"。

**Files:**
- Modify: `src/components/download/DownloadProgress.tsx`
- Modify: `src/pages/tasks/TaskListPanel.tsx`（或对应任务卡片组件）
- Modify: `src/components/download/QueueResumePanel.tsx`

### Step 1: QueueResumePanel 增加恢复状态说明

在 `QueueResumePanel.tsx` 里加一个 `ResumeIndicator` 小组件，当 `queue.exists === true` 时显示：

```tsx
// QueueResumePanel.tsx — 在卡片说明文字下方添加
<div
  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
  style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
>
  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
  <span>
    发现上次未完成的队列（{queue.item_count} 本），继续下载将从断点恢复，
    已下载的章节会自动跳过。
  </span>
</div>
```

### Step 2: DownloadProgress 展示"跳过章节"计数

后端的 `chapter_done` event 在断点跳过时同样触发（`counter.fetch_add` 照常执行），所以前端已有 `current/total` 计数是包含跳过章节的。需要额外区分的信息：恢复下载时"续传书目数"。

在 `ProgressEvent` 里，`novel_start` 事件已有 `novel` + `site` 字段，可以在 `DownloadProgress` 中统计：

```tsx
// 在 DownloadProgress 的 stats 区域加一行
{isResuming && (
  <span className="text-xs" style={{ color: "var(--color-warning)" }}>
    <RotateCcw className="inline w-3 h-3 mr-1" />
    续传模式
  </span>
)}
```

`isResuming` 从 `useDownloadStore` 中读取，`QueueResumePanel` 确认续传时 dispatch 一个 `setResuming(true)` action。

### Step 3: 下载页"清除队列"按钮

`QueueResumePanel` 已有"清除"按钮，但样式不突出。在 `DownloadPage` 的顶部 StatusBar 区域，当 `queue.exists` 时，在任务列表旁加一个浮动的"清除上次队列"ghost 按钮：

```tsx
{queue?.exists && (
  <Button variant="ghost" size="sm" onClick={handleClearQueue}>
    <Trash2 className="w-3.5 h-3.5" />
    清除断点队列
  </Button>
)}
```

**Commit:**
```bash
git commit -m "feat(download): improve resume UI with clear indicator and skip-count"
```

---

## Task 2: 同时运行任务数上限（全局并发控制）

**背景：** `TaskManager.max_concurrent = 3` 硬编码，前端没有办法调整。用户在网络差时希望只跑 1 个任务，网络好时希望跑更多。

**目标：** 在设置页 `ConcurrencySection` 加一个"同时下载任务数"（1-5）的输入框，持久化到 `AppConfig.concurrency.novel_threads`（前端字段复用，后端 `TaskManager.max_concurrent` 从配置读取）。

**注意：** `novel_threads` 原意是"同时下载几本书"（Semaphore 并发），和任务级别的"同时跑几个 Task"是两个层级。任务级并发走 `TaskManager.max_concurrent`，目前没有配置接口。

**实现方案（最小改动）：**

后端 `lib.rs` 的 `run()` 函数中，`TaskManager::new(base_dir)` 后立即从 config 读取 `novel_threads` 来设置 `max_concurrent`：

```rust
// src-tauri/src/lib.rs — setup 回调内
let cfg = config_db::load_config(&app_data).unwrap_or_default();
let max_c = cfg.concurrency.novel_threads.min(5).max(1);
let task_manager = Arc::new(Mutex::new(TaskManager::new_with_max(base_dir, max_c)));
```

给 `TaskManager` 加一个构造函数：
```rust
pub fn new_with_max(base_dir: PathBuf, max_concurrent: usize) -> Self {
    Self { handles: HashMap::new(), base_dir, max_concurrent }
}
```

在 `create_scan_task` / `create_batch_download_task` 等 command 里，启动任务前检查 `running_count() >= max_concurrent`，如果超限则将任务标记为 `queued` 先不 spawn，由 `postTaskComplete` hook 触发 pending 任务。

**Files:**
- Modify: `src-tauri/src/task_manager/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/pages/settings/sections/ConcurrencySection.tsx`（加说明文字）

**ConcurrencySection 修改：** 将 `novel_threads` 的标签从"并行小说数"改为"并行下载数（含任务并发上限）"，范围提示 1-5，并加说明：

```tsx
<Input
  label="并行下载数（每个任务内同时下载几本，同时也是任务并发上限）"
  type="number"
  {...register("novel_threads")}
/>
<p className="text-xs mt-1" style={{ color: "var(--color-text-subtle)" }}>
  1 = 稳定串行，2-3 = 推荐，5 = 网络极好时使用。同时也限制任务管理器最多并行几个任务。
</p>
```

**Commit:**
```bash
git commit -m "feat(concurrency): max_concurrent tasks driven by novel_threads config"
```

---

## Task 3: 下载前站点预检

**背景：** `HealthPage` 已有完整的站点健康检测（`SiteHealthChecker` 组件 + `apiCheckSites`），但下载时不做预检，任务静默失败。

**目标：** 在 `DownloadPage` 的扫描启动前，弹出一个可折叠的"预检"面板，快速 ping 所有启用站点，显示可达/不可达，让用户决定是否继续。

**Files:**
- Create: `src/components/download/PreflightPanel.tsx`
- Modify: `src/pages/DownloadPage.tsx`

### Step 1: 创建 PreflightPanel.tsx

```tsx
// src/components/download/PreflightPanel.tsx
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";
import { apiCheckSites } from "@/lib/api";
import type { SiteHealth } from "@/types";

interface Props {
  domains: string[];           // 当前启用的站点 domain_name 列表
  onDismiss: () => void;       // 用户手动关闭面板
  onConfirm: () => void;       // 用户确认忽略警告，继续下载
}

export function PreflightPanel({ domains, onDismiss, onConfirm }: Props) {
  const [results, setResults] = useState<SiteHealth[]>([]);
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState(false);

  const runCheck = async () => {
    setChecking(true);
    setDone(false);
    try {
      const res = await apiCheckSites(domains);
      setResults(res);
    } finally {
      setChecking(false);
      setDone(true);
    }
  };

  const failCount = results.filter(r => !r.reachable).length;

  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          下载前预检
        </span>
        <button onClick={onDismiss} style={{ color: "var(--color-text-muted)" }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        快速检测 {domains.length} 个已启用站点的可达性，帮你提前发现问题。
      </p>

      {!done && (
        <button
          onClick={runCheck}
          disabled={checking}
          className="flex items-center gap-2 self-start rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {checking ? "检测中..." : "开始检测"}
        </button>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
          {results.map(r => (
            <div key={r.domain} className="flex items-center gap-2 text-xs">
              {r.reachable
                ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-success)" }} />
                : <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-danger)" }} />
              }
              <span className="flex-1 truncate" style={{ color: "var(--color-text)" }}>
                {r.domain.replace(/^https?:\/\//, "")}
              </span>
              <span style={{ color: r.reachable ? "var(--color-text-subtle)" : "var(--color-danger)" }}>
                {r.reachable ? `${r.latency_ms}ms` : (r.error ?? "不可达")}
              </span>
            </div>
          ))}
        </div>
      )}

      {done && (
        <div className="flex items-center gap-2">
          {failCount > 0 && (
            <div
              className="flex-1 rounded-lg px-3 py-2 text-xs"
              style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
            >
              {failCount} 个站点不可达，下载这些站点的书籍可能会失败
            </div>
          )}
          {failCount === 0 && (
            <div
              className="flex-1 rounded-lg px-3 py-2 text-xs"
              style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
            >
              所有站点可达，可以开始下载
            </div>
          )}
          <button
            onClick={onConfirm}
            className="rounded-lg px-3 py-1.5 text-xs font-medium shrink-0"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            继续下载
          </button>
        </div>
      )}
    </div>
  );
}
```

### Step 2: 集成到 DownloadPage

在 `DownloadPage.tsx` 的 idle 状态面板（`IdlePanel`）下方，加一个折叠式的"预检"触发入口：

```tsx
// 在 IdlePanel 的 actions 区域（或 DownloadPage 主内容区）添加：
import { PreflightPanel } from "@/components/download/PreflightPanel";
import { useConfigStore } from "@/store/configStore";

// 在组件内
const { config } = useConfigStore();
const [showPreflight, setShowPreflight] = useState(false);

const enabledDomains = Object.values(config?.websites ?? {})
  .filter(w => w.enabled)
  .map(w => w.domain_name);

// 在 IdlePanel 下面：
{showPreflight && (
  <PreflightPanel
    domains={enabledDomains}
    onDismiss={() => setShowPreflight(false)}
    onConfirm={() => { setShowPreflight(false); handleStartDownload(); }}
  />
)}

// 在 PageHeader actions 添加一个可选的触发按钮（ghost，不影响主流程）
<Button variant="ghost" size="sm" onClick={() => setShowPreflight(v => !v)}>
  <Activity className="w-3.5 h-3.5" />
  预检站点
</Button>
```

**Commit:**
```bash
git commit -m "feat(download): add optional preflight site health check panel"
```

---

## Task 4: 章节质量评分

**背景：** 中文小说站常见防盗章手段——章节内容极短（< 200 字）或包含特定广告模板，但章节正常加载不报错。当前工具无法自动识别这类情况。

**目标：** 下载完成后，对每本书的 temp 章节文件做字数统计，将"疑似防盗章"（字数低于阈值）标注到任务详情里，供用户查看。

**方案：** 纯前端实现。后端已经在 `novel_pass.rs` 的 first_pass 里跳过了 `>= 1024 bytes` 的文件（即已认为合格），但没有上报细节。最小改动方案：在前端任务详情里，对已完成任务的 `error_count` 做展示增强，并加一个"质量分析"入口，让用户手动触发对本地 txt 文件的统计。

**更好的方案（无需后端改动）：** 新增一个 `QualityChecker` 组件，在 `BookshelfPage` 或任务详情里，读取已下载的 txt 文件（通过 `apiListBooks` 获取路径），对每个文件做前 N 章的字数统计，标出异常章节。

**Files:**
- Create: `src/components/download/ChapterQualityReport.tsx`
- Modify: `src/pages/bookshelf/BookshelfPage.tsx`

### Step 1: 创建 ChapterQualityReport 组件

```tsx
// src/components/download/ChapterQualityReport.tsx
import { useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2 } from "lucide-react";

interface ChapterStat {
  index: number;
  charCount: number;
  suspicious: boolean;
}

interface Props {
  /** 书的全文内容（已读取的文本） */
  content: string;
  threshold?: number;  // 默认 300 字认为可疑
}

function splitChapters(content: string): string[] {
  // 按常见章节标题分割：第X章/第X节/Chapter N 等
  return content.split(/\n(?=第[零一二三四五六七八九十百千\d]+[章节回折幕])/);
}

export function ChapterQualityReport({ content, threshold = 300 }: Props) {
  const chapters = splitChapters(content);
  const stats: ChapterStat[] = chapters.map((ch, i) => {
    const charCount = ch.replace(/\s/g, "").length;
    return { index: i + 1, charCount, suspicious: charCount < threshold };
  });

  const suspiciousCount = stats.filter(s => s.suspicious).length;
  const ratio = chapters.length > 0 ? suspiciousCount / chapters.length : 0;

  if (chapters.length <= 1) {
    return (
      <div className="text-xs py-2" style={{ color: "var(--color-text-subtle)" }}>
        无法识别章节结构（可能不是标准章节格式）
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs">
        {suspiciousCount === 0 ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--color-success)" }} />
            <span style={{ color: "var(--color-success)" }}>
              全部 {chapters.length} 章正常（每章 ≥ {threshold} 字）
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: "var(--color-warning)" }} />
            <span style={{ color: "var(--color-warning)" }}>
              {suspiciousCount}/{chapters.length} 章可能是防盗章（字数 ＜ {threshold}）
            </span>
          </>
        )}
      </div>

      {ratio > 0.1 && (
        <div
          className="text-xs rounded-lg px-3 py-2"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
        >
          超过 10% 的章节字数异常，建议检查站点规则是否需要调整内容 XPath 或 fallback 规则。
        </div>
      )}

      {suspiciousCount > 0 && suspiciousCount <= 20 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            可疑章节：
          </span>
          {stats.filter(s => s.suspicious).slice(0, 10).map(s => (
            <span key={s.index} className="text-xs font-mono" style={{ color: "var(--color-danger)" }}>
              第 {s.index} 章：{s.charCount} 字
            </span>
          ))}
          {suspiciousCount > 10 && (
            <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
              …还有 {suspiciousCount - 10} 章
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

### Step 2: 在 BookshelfPage 的书目行添加"质量检查"

在书架的每本书操作区加一个"检查"按钮（仅 Tauri 模式，因为需要读取本地文件），点击读取文件内容后展示 `ChapterQualityReport`：

```tsx
// 在 BookshelfPage.tsx 的书目行 actions 区域
import { ChapterQualityReport } from "@/components/download/ChapterQualityReport";

// 使用 Tauri fs 读取文件内容
const [qualityTarget, setQualityTarget] = useState<{ path: string; content: string } | null>(null);

const handleCheckQuality = async (book: BookFile) => {
  try {
    const fs = await import("@tauri-apps/plugin-fs");
    const content = await fs.readTextFile(book.path);
    setQualityTarget({ path: book.path, content });
  } catch {
    toast.error("无法读取文件");
  }
};

// 在书目行末尾加按钮（仅 Tauri）
{typeof window.__TAURI_INTERNALS__ !== "undefined" && (
  <button
    onClick={() => handleCheckQuality(book)}
    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
    style={{ color: "var(--color-text-muted)" }}
    title="章节质量检查"
  >
    <Activity className="w-3.5 h-3.5" />
  </button>
)}
```

**Commit:**
```bash
git commit -m "feat(bookshelf): add chapter quality report (suspicious short chapters)"
```

---

## Task 5: 自定义后处理脚本

**目标：** 下载完成后，如果用户配置了后处理命令，自动执行（传入下载目录路径作为参数）。

**实现方案：** 在 `AppConfig` 里加一个 `post_download_script: Option<String>` 字段，在设置页 `PathSection` 下方展示一个 `PostScriptSection`，后端在 `execute_download_batch` 结束后执行脚本。

**Files:**
- Modify: `src/types/index.ts`（扩展 AppConfig）
- Modify: `src-tauri/src/models/config.rs`（添加字段）
- Create: `src/pages/settings/sections/PostScriptSection.tsx`
- Modify: `src/pages/settings/SettingsPage.tsx`（集成 section）
- Modify: `src/pages/settings/settingsSchema.ts`（添加 schema 字段）
- Modify: `src-tauri/src/downloader/mod.rs`（下载后执行脚本）
- Modify: `src-tauri/src/server/routes.rs` 或相关配置路由（dev-server fallback）

### Step 1: 类型和配置扩展

**前端 `types/index.ts`：**

```typescript
// 在 AppConfig 接口末尾加入：
export interface PostProcessConfig {
  /** Shell command to run after download; %DIR% is replaced with base_dir */
  script: string;
  /** Run on download complete (true) or on each novel done (false) */
  run_on_batch_done: boolean;
  enabled: boolean;
}

// AppConfig 中：
post_process?: PostProcessConfig;
```

**Rust `models/config.rs`：**

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PostProcessConfig {
    #[serde(default)]
    pub script: String,
    #[serde(default = "default_true")]
    pub run_on_batch_done: bool,
    #[serde(default)]
    pub enabled: bool,
}

// AppConfig 中：
#[serde(default)]
pub post_process: PostProcessConfig,
```

### Step 2: 设置页 UI

```tsx
// src/pages/settings/sections/PostScriptSection.tsx
import { useFormContext } from "react-hook-form";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import type { SettingsForm } from "../settingsSchema";
import { Terminal } from "lucide-react";

export function PostScriptSection() {
  const { register, watch } = useFormContext<SettingsForm>();
  const enabled = watch("post_process_enabled");

  return (
    <Card title="后处理脚本">
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: "var(--color-text)" }}>
          <input type="checkbox" className="h-3.5 w-3.5" {...register("post_process_enabled")} />
          <span>下载完成后执行脚本</span>
        </label>

        {enabled && (
          <>
            <Input
              label="命令（%DIR% 会被替换为下载目录）"
              placeholder='xcopy "%DIR%" "\\NAS\books\" /E /Y'
              {...register("post_process_script")}
            />
            <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: "var(--color-text-muted)" }}>
              <input type="checkbox" className="h-3.5 w-3.5" {...register("post_process_batch_done")} />
              <span>整批下载完成后执行一次（否则每本书完成后执行）</span>
            </label>
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
            >
              <Terminal className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                示例：<code className="font-mono">robocopy "%DIR%" "D:\备份" *.txt *.epub /MIR</code>
                <br />
                命令在 cmd.exe 中执行，可以是任意批处理命令或调用外部程序。
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
```

**settingsSchema.ts 追加字段：**

```typescript
// 在 settingsSchema z.object({...}) 中添加：
post_process_enabled: z.boolean(),
post_process_script: z.string(),
post_process_batch_done: z.boolean(),
```

**configToForm / formToConfig 对应更新。**

### Step 3: 后端脚本执行

在 `src-tauri/src/downloader/mod.rs` 的 `run_download` 和 `run_download_selected` 结束处（`OverallDone` 发送前）加：

```rust
// 执行后处理脚本
let post = &config.post_process;
if post.enabled && !post.script.is_empty() && post.run_on_batch_done {
    let script = post.script.replace("%DIR%", base_dir.to_str().unwrap_or(""));
    let _ = tokio::process::Command::new("cmd")
        .args(["/C", &script])
        .spawn();
    log(&tx, logger.as_ref(), "info",
        format!("已触发后处理脚本: {}", &post.script)).await;
}
```

**Commit:**
```bash
git commit -m "feat(settings): post-download script execution"
```

---

## Task 6: 文本工具箱扩展（ConverterPage 增强）

**目标：** 将 `ConverterPage` 从单一的"繁简转换"扩展为支持 4 种操作的文本工具箱：
1. 繁→简（现有）
2. 合并多个 TXT 文件为一个
3. 按章节标题分割 TXT 为多个文件
4. 编码转换（GBK → UTF-8）

**Files:**
- Modify: `src/pages/ConverterPage.tsx`
- Modify: `src/lib/api/files.ts`（新增 apiMergeFiles + apiSplitFile）
- Modify: `src-tauri/src/lib.rs`（新增 merge_files + split_file Tauri commands）
- Create: `src-tauri/src/text_tools.rs`（工具函数）

### Step 1: 后端 text_tools.rs

```rust
// src-tauri/src/text_tools.rs

/// 合并多个 txt 文件，按顺序拼接，文件间加换行分隔
pub async fn merge_files(paths: Vec<String>, output: String) -> anyhow::Result<String> {
    use tokio::io::AsyncWriteExt;
    let mut f = tokio::fs::File::create(&output).await?;
    for path in &paths {
        let content = tokio::fs::read_to_string(path).await
            .unwrap_or_default();
        f.write_all(content.as_bytes()).await?;
        f.write_all(b"\n").await?;
    }
    Ok(format!("已合并 {} 个文件到 {}", paths.len(), output))
}

/// 按章节标题切割，生成 chN.txt 系列文件，输出到同目录
pub async fn split_file(path: String, pattern: Option<String>) -> anyhow::Result<Vec<String>> {
    let content = tokio::fs::read_to_string(&path).await?;
    let dir = std::path::Path::new(&path).parent()
        .unwrap_or_else(|| std::path::Path::new("."));
    let stem = std::path::Path::new(&path)
        .file_stem().and_then(|s| s.to_str()).unwrap_or("output");

    let pat = pattern.as_deref().unwrap_or(r"^第[零一二三四五六七八九十百千\d]+[章节]");
    let re = regex::Regex::new(pat)?;

    let mut chapters: Vec<(String, String)> = Vec::new(); // (title, content)
    let mut current_title = "前言".to_string();
    let mut current_content = String::new();

    for line in content.lines() {
        if re.is_match(line) {
            if !current_content.trim().is_empty() {
                chapters.push((current_title.clone(), current_content.clone()));
            }
            current_title = line.to_string();
            current_content = line.to_string() + "\n";
        } else {
            current_content.push_str(line);
            current_content.push('\n');
        }
    }
    if !current_content.trim().is_empty() {
        chapters.push((current_title, current_content));
    }

    let mut outputs = Vec::new();
    for (i, (_title, ch_content)) in chapters.iter().enumerate() {
        let fname = dir.join(format!("{}_ch{:03}.txt", stem, i + 1));
        tokio::fs::write(&fname, ch_content.as_bytes()).await?;
        outputs.push(fname.to_string_lossy().to_string());
    }
    Ok(outputs)
}
```

### Step 2: Tauri commands + API layer

```rust
// lib.rs 中新增：
#[tauri::command]
async fn merge_files(paths: Vec<String>, output: String) -> Result<String, String> {
    crate::text_tools::merge_files(paths, output).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn split_file(path: String, pattern: Option<String>) -> Result<Vec<String>, String> {
    crate::text_tools::split_file(path, pattern).await.map_err(|e| e.to_string())
}
```

`Cargo.toml` 需要添加 `regex = "1"` 依赖（如果尚未有）。

### Step 3: 前端 ConverterPage 重构

将页面从单一模式改为 Tab 式（4 个操作），每个 Tab 复用现有的 `Card` + `Button` + `Input` 组件：

```tsx
// ConverterPage.tsx 顶部加 Tab 切换
type ToolMode = "t2s" | "merge" | "split" | "encoding";

const TABS: { id: ToolMode; label: string; icon: React.ComponentType }[] = [
  { id: "t2s",      label: "繁→简",     icon: Languages },
  { id: "merge",    label: "合并文件",   icon: Merge },
  { id: "split",    label: "按章分割",   icon: Scissors },
  { id: "encoding", label: "编码转换",   icon: RefreshCw },
];

// 渲染：
<div className="flex gap-1 border-b" style={{ borderColor: "var(--color-border)" }}>
  {TABS.map(t => (
    <button
      key={t.id}
      onClick={() => setMode(t.id)}
      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
      style={{
        color: mode === t.id ? "var(--color-accent)" : "var(--color-text-muted)",
        borderBottom: mode === t.id ? "2px solid var(--color-accent)" : "2px solid transparent",
      }}
    >
      <t.icon className="w-3.5 h-3.5" />
      {t.label}
    </button>
  ))}
</div>
```

**注意：** `encoding` 模式调用已有的 `apiConvertFile`（原来只做繁简转换），如果要加编码转换需要后端新增命令，可以在第一版中标注"即将支持"并展示说明文字。

**Commit:**
```bash
git commit -m "feat(converter): expand to text toolbox with merge, split, encoding tabs"
```

---

## Task 7: 自定义主题编辑器

**目标：** 在侧边栏底部的主题切换区（`ThemeSwitcher`）旁加入"自定义"选项，点击打开一个紧凑的颜色编辑面板，允许用户调整 accent 色、背景色，实时预览，保存到 localStorage。

**Files:**
- Modify: `src/store/themeStore.ts`（增加 custom theme 支持）
- Create: `src/components/ThemeEditor.tsx`
- Modify: `src/components/ThemeSwitcher.tsx`（添加"自定义"入口）

### Step 1: themeStore 扩展

```typescript
// 在 themeStore.ts 中添加：

export interface CustomThemeVars {
  accent: string;       // e.g. "#b07235"
  bg: string;           // e.g. "#faf8f4"
  surface: string;
  text: string;
}

const CUSTOM_THEME_KEY = "txtx-custom-theme";

function loadCustomTheme(): CustomThemeVars | null {
  try {
    const raw = localStorage.getItem(CUSTOM_THEME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function applyCustomTheme(vars: CustomThemeVars) {
  const root = document.documentElement;
  root.style.setProperty("--color-accent", vars.accent);
  root.style.setProperty("--color-accent-hover", vars.accent); // simplified
  root.style.setProperty("--color-bg", vars.bg);
  root.style.setProperty("--color-surface", vars.surface);
  root.style.setProperty("--color-text", vars.text);
  root.setAttribute("data-theme", "light"); // base on light
}

// ThemeStore 中增加：
interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  customVars: CustomThemeVars | null;
  setCustomVars: (vars: CustomThemeVars) => void;
  clearCustom: () => void;
}

// setTheme 中：若 theme !== "custom"，调用 applyTheme(theme) 并清除 inline styles
// setCustomVars 中：保存 localStorage + applyCustomTheme(vars)
```

### Step 2: ThemeEditor 组件

```tsx
// src/components/ThemeEditor.tsx
import { useState } from "react";
import { Palette, X } from "lucide-react";
import { useThemeStore, type CustomThemeVars } from "@/store/themeStore";

const PRESET_ACCENTS = [
  { label: "琥珀", value: "#b07235" },
  { label: "陶棕", value: "#c2622a" },
  { label: "石绿", value: "#2d7d5a" },
  { label: "天蓝", value: "#1a85c8" },
  { label: "玫红", value: "#c0395a" },
  { label: "紫色", value: "#7c3aed" },
];

interface Props {
  onClose: () => void;
}

export function ThemeEditor({ onClose }: Props) {
  const { customVars, setCustomVars, theme, setTheme } = useThemeStore();
  const [draft, setDraft] = useState<CustomThemeVars>(
    customVars ?? { accent: "#b07235", bg: "#faf8f4", surface: "#fffefb", text: "#2d2419" }
  );

  const apply = (patch: Partial<CustomThemeVars>) => {
    const updated = { ...draft, ...patch };
    setDraft(updated);
    setCustomVars(updated);
    if (theme !== ("custom" as any)) setTheme("custom" as any);
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-3"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-md)",
        minWidth: 220,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
          自定义主题
        </span>
        <button onClick={onClose} style={{ color: "var(--color-text-muted)" }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Accent color */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Accent 色</span>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_ACCENTS.map(p => (
            <button
              key={p.value}
              onClick={() => apply({ accent: p.value })}
              className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                background: p.value,
                borderColor: draft.accent === p.value ? "var(--color-text)" : "transparent",
              }}
              title={p.label}
            />
          ))}
          <input
            type="color"
            value={draft.accent}
            onChange={e => apply({ accent: e.target.value })}
            className="w-6 h-6 rounded-full cursor-pointer border-0 p-0"
            style={{ appearance: "none" }}
            title="自定义颜色"
          />
        </div>
      </div>

      {/* Background */}
      <div className="flex items-center gap-2">
        <span className="text-xs w-12 shrink-0" style={{ color: "var(--color-text-muted)" }}>背景</span>
        <input
          type="color"
          value={draft.bg}
          onChange={e => apply({ bg: e.target.value })}
          className="w-6 h-6 rounded cursor-pointer"
        />
        <code className="text-xs font-mono" style={{ color: "var(--color-text-subtle)" }}>
          {draft.bg}
        </code>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs w-12 shrink-0" style={{ color: "var(--color-text-muted)" }}>卡片</span>
        <input
          type="color"
          value={draft.surface}
          onChange={e => apply({ surface: e.target.value })}
          className="w-6 h-6 rounded cursor-pointer"
        />
        <code className="text-xs font-mono" style={{ color: "var(--color-text-subtle)" }}>
          {draft.surface}
        </code>
      </div>

      <button
        onClick={() => {
          localStorage.removeItem("txtx-custom-theme");
          setTheme("light");
          onClose();
        }}
        className="text-xs"
        style={{ color: "var(--color-text-subtle)" }}
      >
        重置为默认
      </button>
    </div>
  );
}
```

### Step 3: ThemeSwitcher 集成

在 `ThemeSwitcher.tsx` 中，在主题列表末尾加一个"自定义"按钮，点击弹出 `ThemeEditor`（Popover 定位在按钮上方）：

```tsx
import { ThemeEditor } from "./ThemeEditor";
import { Palette } from "lucide-react";

// 在 ThemeSwitcher 组件内
const [showEditor, setShowEditor] = useState(false);

// 在主题点击列末尾：
<button
  onClick={() => setShowEditor(v => !v)}
  className="relative flex h-7 w-7 items-center justify-center rounded-full border"
  style={{
    background: "var(--color-surface-2)",
    borderColor: "var(--color-border)",
    color: "var(--color-text-muted)",
  }}
  title="自定义主题"
>
  <Palette className="w-3.5 h-3.5" />
</button>

{showEditor && (
  <div className="absolute bottom-full mb-2 left-0 z-50">
    <ThemeEditor onClose={() => setShowEditor(false)} />
  </div>
)}
```

**Commit:**
```bash
git commit -m "feat(theme): custom theme editor with accent/bg color pickers"
```

---

## Task 8: 规则向导——简介规则字段

**背景：** 中文小说目录页通常有书籍简介（`<div class="intro">` 或类似结构），当前 `WebsiteConfig` 和 `WizardData` 没有提供"书籍简介"XPath 字段。添加后可以用来：① 在书架显示简介；② 在下载完成后写入文件头部。

**目标：** 在规则向导 Step 3（目录规则）和 Step 7（保存）加入"书籍简介 XPath"选填字段；扩展 `WebsiteConfig` 和 `WizardData`。

**Files:**
- Modify: `src/types/index.ts`（WebsiteConfig 加 `book_intro_x?: string`）
- Modify: `src-tauri/src/models/config.rs`（WebsiteConfig 加同字段）
- Modify: `src/components/rule-wizard/ruleUtils.ts`（WizardData 加 `chap_intro` FieldRule）
- Modify: `src/components/rule-wizard/WizardStepCatalog.tsx`（Step 3，加简介输入区）
- Modify: `src/components/rule-wizard/WizardStep6Save.tsx`（Step 7，汇总展示 + patch 输出）
- Modify: `src-tauri/src/downloader/novel.rs`（下载时写入简介到文件头，可选）

### Step 1: 类型扩展

**前端 `types/index.ts`，`WebsiteConfig` 添加：**

```typescript
/** XPath to extract the book introduction/summary from the catalog page. Optional. */
book_intro_x?: string;
```

**Rust `models/config.rs`，`WebsiteConfig` 添加：**

```rust
/// XPath to extract book introduction from the catalog page. Empty = skip.
#[serde(default)]
pub book_intro_x: String,
```

### Step 2: WizardData 扩展

在 `ruleUtils.ts` 的 `WizardData` 接口中，在 Step 3 区域加入：

```typescript
// ── Step 3: 目录规则 ──────────────────────────────────────────────────────────
// 新增：
chap_intro: FieldRule;   // 书籍简介 XPath（可选）
```

在 `emptyWizardData` 中初始化：

```typescript
chap_intro: emptyFieldRule("xpath"),
```

在 `wizardDataFromSite` 中：

```typescript
chap_intro: fieldRuleFromXPath(site.book_intro_x ?? ""),
```

### Step 3: WizardStepCatalog 加简介输入

在 `WizardStepCatalog.tsx` 的现有书名配置区域（`book_name_use_xpath` 相关）**下方**，加入简介规则区，复用 `FieldRuleEditor` 组件：

```tsx
{/* ── 简介规则（可选）────────────────────────────────────────────── */}
<div
  className="flex flex-col gap-2 rounded-xl border p-3"
  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
>
  <div className="flex items-center gap-2">
    <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
      书籍简介 XPath
    </span>
    <span
      className="text-xs px-1.5 py-0.5 rounded-full"
      style={{
        background: "var(--color-surface-2)",
        color: "var(--color-text-subtle)",
        border: "1px solid var(--color-border)",
      }}
    >
      选填
    </span>
  </div>
  <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
    从目录页提取书籍简介，会写入下载文件的头部。
    常见位置：<code className="font-mono">//div[@class="intro"]</code>
  </p>
  <FieldRuleEditor
    rule={data.chap_intro}
    onChange={(r) => onChange({ ...data, chap_intro: r })}
    label="简介 XPath"
  />
</div>
```

### Step 4: WizardStep6Save 汇总和 patch 输出

在 `summary` 数组中加入（非必填，xpath 为空时显示"未设置"）：

```typescript
...(buildXPathFromRule(data.chap_intro)
  ? [{ label: "书籍简介 XPath", value: buildXPathFromRule(data.chap_intro) }]
  : []),
```

在 `handleApply` 的 `patch` 对象中加入：

```typescript
book_intro_x: buildXPathFromRule(data.chap_intro) || "",
```

### Step 5: 后端写入简介（可选，最小版本先跳过）

如果简介 XPath 有值，在 `download_novel` 里，获取章节列表前先请求目录页提取简介文本，在 `merge_chapters` 后把简介写到 txt 文件头部。

具体实现：在 `novel.rs` 的 `download_novel` 中：

```rust
// 如果有 book_intro_x，从目录页提取简介
let intro_text = if !site_cfg.book_intro_x.is_empty() {
    // 复用 get_chapter_urls 的 HTTP client，用 XPath 提取简介
    // （抽取为单独函数 extract_book_intro，放在 crawler 层）
    crate::crawler::extract_text(client, &candidate.url, &site_cfg.book_intro_x,
        &net_cfg.encoding_map, net_cfg.retry_count, net_cfg.retry_delay).await.ok()
} else {
    None
};

// merge 完成后，如有简介，prepend 到文件
if let Some(intro) = intro_text {
    let header = format!("【书籍简介】\n{}\n\n{}\n\n", candidate.name, intro);
    // 读取 final_path 内容，prepend header，重新写入
    let existing = tokio::fs::read_to_string(&final_path).await.unwrap_or_default();
    tokio::fs::write(&final_path, (header + &existing).as_bytes()).await?;
}
```

**Commit:**
```bash
git commit -m "feat(wizard): add book intro xpath field to catalog step and WebsiteConfig"
```

---

## 执行顺序建议

| 优先级 | Task | 理由 |
|--------|------|------|
| 🔥 高 | Task 8（简介规则） | 纯前端，改动小，用户直接可见 |
| 🔥 高 | Task 3（下载预检） | 纯前端，复用现有 API，性价比最高 |
| ⚡ 中 | Task 7（主题编辑器） | 前端，无后端依赖，但代码量稍大 |
| ⚡ 中 | Task 6（文本工具箱） | 需要后端新增 2 个命令，改动适中 |
| 📦 低 | Task 1（续传可视化） | 已有逻辑，只是 UI 增强 |
| 📦 低 | Task 4（质量评分） | 复用书架页面 |
| 📦 低 | Task 2（并发控制） | 需要后端配合，但逻辑相对简单 |
| 📦 低 | Task 5（后处理脚本） | 全栈改动，需测试安全性 |

## 验收标准

- `pnpm tsc --noEmit` 零错误
- `pnpm run build --mode development` 零错误
- `cargo check --manifest-path src-tauri/Cargo.toml` 零错误（仅 Task 2/5/6/8 后端部分需要）
- 新组件在 light / dark 两个主题下显示正常
- 新设置字段在保存后重新加载不丢失

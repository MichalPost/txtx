# Third-Party Libs Optimization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 引入 5 个第三方库替代手写样板代码，提升代码质量和用户体验。

**Architecture:** 前端引入 React Query（替代手写 loading/error 状态）、sonner（toast 通知）、dayjs（时间格式化）、react-virtual（日志虚拟滚动）；Rust 后端引入 backon（替代手写重试循环）。

**Tech Stack:** React 19, Zustand, TanStack Query v5, Sonner, Dayjs, TanStack Virtual, Rust backon 1.x

---

## Task 1: 安装前端依赖

**Files:**
- Modify: `txtx-app/package.json`

**Step 1: 安装依赖**

```bash
cd txtx-app
pnpm add @tanstack/react-query@5 sonner dayjs @tanstack/react-virtual
```

**Step 2: 验证 package.json 中出现新依赖**

---

## Task 2: 配置 React Query Provider + Sonner Toaster

**Files:**
- Modify: `txtx-app/src/main.tsx`

将 `QueryClientProvider` 和 `Toaster` 包裹 App：

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

ReactDOM.createRoot(...).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  </React.StrictMode>
);
```

---

## Task 3: HistoryPage 改用 React Query

**Files:**
- Modify: `txtx-app/src/pages/HistoryPage.tsx`

替换手写 useState loading/error + useEffect fetch，改用 useQuery + useMutation：

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const { data = [], isLoading, error, refetch } = useQuery({
  queryKey: ["history"],
  queryFn: apiGetHistory,
  select: (d) => [...d].reverse(),
});

const qc = useQueryClient();
const clearMutation = useMutation({
  mutationFn: apiClearHistory,
  onSuccess: () => { qc.invalidateQueries({ queryKey: ["history"] }); toast.success("历史已清空"); },
  onError: (e) => toast.error(String(e)),
});
```

删除所有手写 `useState<HistoryEntry[]>`、`useState(false)`、`useState(null)` 和 `useEffect`。

---

## Task 4: HealthPage 改用 React Query

**Files:**
- Modify: `txtx-app/src/pages/HealthPage.tsx`

用 `useMutation` 替代手写 checking/error/results state：

```tsx
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

const { mutate: checkSites, data: results = [], isPending: checking } = useMutation({
  mutationFn: apiCheckSites,
  onError: (e) => toast.error(String(e)),
});
```

删除 `useState<SiteHealth[]>`、`useState(false)`、`useState(null)`、`useState(false)` 四个 state。

---

## Task 5: configStore 的 saveConfig 加 toast 反馈

**Files:**
- Modify: `txtx-app/src/store/configStore.ts`
- Modify: `txtx-app/src/pages/SettingsPage.tsx`
- Modify: `txtx-app/src/pages/BlacklistPage.tsx`
- Modify: `txtx-app/src/pages/WebsitesPage.tsx`

在 `configStore.saveConfig` 成功/失败时调用 `toast`，并删除各页面手写的 `saved` state + setTimeout：

```ts
// configStore.ts
import { toast } from "sonner";

saveConfig: async (config) => {
  set({ saving: true, error: null });
  try {
    await apiSaveConfig(config);
    set({ config, saving: false });
    toast.success("配置已保存");
  } catch (e) {
    set({ error: String(e), saving: false });
    toast.error(`保存失败: ${String(e)}`);
  }
},
```

各页面删除 `const [saved, setSaved] = useState(false)` 和 `setTimeout` 逻辑，按钮文字简化为 "保存"。

---

## Task 6: DownloadPage 日志用 dayjs 格式化时间戳

**Files:**
- Modify: `txtx-app/src/store/downloadStore.ts`

替换 `new Date().toLocaleTimeString("zh-CN", { hour12: false })`：

```ts
import dayjs from "dayjs";

// 在 addLog 中：
timestamp: dayjs().format("HH:mm:ss"),
```

---

## Task 7: DownloadPage 日志面板改用虚拟滚动

**Files:**
- Modify: `txtx-app/src/pages/DownloadPage.tsx`

用 `@tanstack/react-virtual` 替代直接渲染全部 log 条目：

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

const parentRef = useRef<HTMLDivElement>(null);
const virtualizer = useVirtualizer({
  count: logs.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 20,
  overscan: 10,
});

// 渲染：
<div ref={parentRef} className="flex-1 overflow-y-auto ...">
  <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
    {virtualizer.getVirtualItems().map((item) => (
      <div key={item.key} style={{ position: "absolute", top: item.start, width: "100%" }}>
        <LogLine entry={logs[item.index]} />
      </div>
    ))}
  </div>
</div>
```

自动滚动到底部改为：当新日志到来时，调用 `virtualizer.scrollToIndex(logs.length - 1)`。

---

## Task 8: Rust 后端 backon 替代手写重试

**Files:**
- Modify: `txtx-app/src-tauri/Cargo.toml`
- Modify: `txtx-app/src-tauri/src/crawler.rs`
- Modify: `txtx-app/src-tauri/src/downloader.rs`

**Step 1: 添加依赖**

```toml
backon = "1"
```

**Step 2: 改造 fetch_page（crawler.rs）**

```rust
use backon::{ExponentialBuilder, Retryable};

pub async fn fetch_page(...) -> Result<String> {
    let fetch = || async {
        let resp = client.get(url).send().await?;
        let bytes = resp.bytes().await?;
        // ... decode
        Ok::<String, anyhow::Error>(text)
    };

    fetch
        .retry(ExponentialBuilder::default()
            .with_max_times(retry_count as usize)
            .with_min_delay(Duration::from_secs(retry_delay)))
        .await
}
```

**Step 3: 删除 downloader.rs 中修复章节的手写重试循环**

repair pass 中的 `for attempt in 0..3` 循环改用 backon。

---

## Task 9: 构建验证

```bash
cd txtx-app
pnpm build
```

确认无 TypeScript 错误，Rust 后端：

```bash
cd txtx-app/src-tauri
cargo check --bin txtx-server
```

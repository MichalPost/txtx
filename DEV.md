# 本地开发指南

本文说明 `txtx` 当前真实可用的开发、运行和验证方式。仓库主流程已经收敛为：`首页发起任务 -> 任务中心执行与查看 -> Rust 后端持久化状态与文件结果`。

## 环境要求

- Node.js + pnpm
- Rust 工具链
- Tauri 2 CLI 由项目依赖提供，可通过 `pnpm tauri` 调用

首次进入仓库后安装依赖：

```bash
pnpm install
```

## 运行方式

### Web 开发模式

一条命令同时启动 Rust HTTP 后端和 Vite 前端：

```bash
pnpm dev
```

默认端口：

- 前端：`http://localhost:1420`
- 后端：`http://localhost:3721`
- Vite 会把 `/api/*` 和 WebSocket 请求代理到 Rust 后端

也可以分开启动，便于分别观察日志：

```bash
pnpm dev:backend
pnpm dev:frontend
```

后端端口可通过环境变量覆盖：

```bash
TXTX_PORT=8080 cargo run --bin txtx-server --manifest-path src-tauri/Cargo.toml
```

如果改了端口，需要同步调整前端 API 入口或代理配置，否则前端仍会请求 `3721`。

### 常见启动问题

如果首页一直显示 `配置加载失败` / `TypeError: Failed to fetch`，通常表示前端已经启动，但 Rust HTTP 后端没有监听 `3721`：

```powershell
Get-NetTCPConnection -LocalPort 3721
```

没有输出时，先启动后端：

```bash
pnpm dev:backend
```

如果本机 Rust shim 阻止 `cargo run` 后台启动，可以先执行一次：

```bash
cargo check --manifest-path src-tauri/Cargo.toml --bin txtx-server
```

然后直接运行编译产物：

```powershell
.\src-tauri\target\debug\txtx-server.exe
```

后端恢复后刷新 `http://localhost:1420`，首页应从 `Failed to fetch` 变为正常任务发起台或“还没有配置站点”的空态。

### Tauri 桌面开发模式

```bash
pnpm dev:tauri
```

该命令会设置 `VITE_TAURI_MODE=true`，前端通过 Tauri invoke / event 使用本地能力；构建 Rust 桌面二进制时会启用 `tauri-build` feature。

## 当前产品主流程

### 首次运行

`RootLayout` 启动时检查是否首次运行。首次运行会展示 `SetupWizard`，用户选择本地保存目录后写入配置，再进入正常页面。

### 首页

首页是任务发起台，负责：

- 单本 URL 下载
- 批量导入 URL
- 按日期范围和站点发起扫描
- 预检站点可用性
- 引导用户进入任务中心查看运行中的任务

首页不再承载完整下载状态机；新入口默认创建任务。

### 任务中心

任务中心是主流程页面，负责：

- 展示扫描、单本、批量、选中下载任务
- 搜索、筛选、排序和查看摘要
- 查看任务详情、日志和失败信息
- 扫描完成后确认候选书单并继续下载
- 暂停、取消、删除和重试任务

任务事件在桌面模式下通过 `task_event` 推送；Web 开发模式下任务列表会轮询 `/api/tasks` 兜底同步。

### 支撑页面

- 规则管理：维护站点规则、XPath、编码覆盖和广告清理预览
- 过滤中心：维护广告词、导航词、黑白名单和清洗策略
- 历史记录：分页查询、筛选、排序、统计和重新下载
- 本地书架：浏览、打开、删除已下载文件
- 文本转换：繁简转换、拆分、合并
- 设置中心：路径、网络、并发、电子书、AI 和后处理配置
- 健康检查：批量检查站点可用性和延迟

## 质量检查命令

建议提交前至少运行：

```bash
pnpm test
pnpm lint
pnpm format:check
pnpm build
pnpm build:tauri
pnpm check:rust
```

常用辅助命令：

```bash
pnpm lint:fix
pnpm format
pnpm preview
```

说明：

- `pnpm test` 使用 Node 内置 test runner，覆盖 `src/**/*.test.ts`，新增嵌套测试目录会自动纳入。
- `pnpm build` 执行 `tsc && vite build`，主要验证前端类型和生产构建。
- `pnpm build:tauri` 使用 `VITE_TAURI_MODE=true` 构建桌面前端产物，避免桌面包误走 Web HTTP 配置加载路径。
- `pnpm check:rust` 同时检查 Rust HTTP server 二进制和 Tauri feature 构建路径。

## 测试注意事项

- 任务流相关改动优先补 `taskStore`、`taskSync`、`taskListUtils`、`TaskDetailPanel` 附近的纯函数或状态同步测试。
- 页面交互尽量把判断逻辑抽到可测试的 util，避免只靠组件人工验证。
- 涉及 Tauri/Web 差异时，同时覆盖 `src/platform` 的能力判断、动态加载和 fallback。
- 历史、书架、过滤、规则向导这类列表页改动，需要覆盖搜索、筛选、排序、空状态和错误提示。
- 测试中不要依赖真实网络、真实小说站点或用户本机目录；使用输入数据和 mock API 表达边界。

## 性能注意事项

- 任务列表、历史记录、扫描预览和书架都可能面对大量数据。新增筛选/排序逻辑应保持不可变输入，并优先用单次遍历聚合摘要。
- 历史记录已经走后端分页和统计，不要重新把全量历史搬回前端做分页。
- Vite 构建启用了页面懒加载和 vendor chunk 拆分。新增大型依赖前先确认是否只在单页使用，必要时动态加载。
- 任务事件可能高频到达，前端应合并快照、保持对象复用，并避免每个事件触发昂贵的全量重算。
- Rust 抓取/下载侧要尊重并发、限速、重试和取消语义，避免在 UI 暂停/取消后继续写入不可预期状态。

## API 与运行边界

Rust HTTP 服务主要暴露：

- `/api/config` 配置读取与保存
- `/api/tasks/*` 任务创建、确认、查询、暂停、取消、删除和预览草稿
- `/api/history/*` 历史分页、统计、站点选项和清空
- `/api/health` 站点健康检查
- `/api/books*` 本地书架
- `/api/tools/*` 文本拆分与合并
- `/api/convert/text` 文本转换
- `/api/ai/*` AI 配置、补全、流式输出和规则抽取
- `/api/scan`、`/api/download*`、`/api/queue`、`/api/stop` 旧下载兼容流

新功能默认优先接入任务体系；旧 WebSocket 下载流仅作为兼容层维护。

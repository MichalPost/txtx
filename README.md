# txtx

`txtx` 是一个本地单机小说下载工具。你输入小说链接，它负责扫描、筛选、下载、记录和整理，尽量安静地把内容放进本地书架。

## 功能概览

- 单本下载、批量导入、全站扫描预览
- 任务中心：搜索、筛选、排序，查看扫描、确认、下载、失败与完成状态
- 规则管理：维护站点规则、XPath、编码覆盖和抓取字段
- 过滤中心：管理广告、导航词、黑名单、白名单和清洗策略
- 本地书架：浏览、打开、删除和检查已下载书籍
- 下载历史：分页查询、统计图表、站点筛选、排序和重新下载
- 文本转换：拆分、合并、编码处理与繁简转换
- 设置中心：路径、网络、并发、电子书、AI 与后处理配置
- 站点健康检查：检查站点可用性和延迟

## 当前主流程

当前推荐流程是：

1. 首次运行时选择本地保存目录
2. 在首页发起单本下载、批量导入或站点扫描
3. 进入任务中心查看进度、日志和失败信息
4. 扫描完成后在任务详情中确认候选书单
5. 后端继续下载，完成后写入历史和本地书架

一句话原则：`首页负责发起，任务中心负责执行与查看，Rust 后端负责真实状态与持久化`。

## 技术栈

- 前端：React 19、TypeScript、Vite、React Router、Zustand、TanStack Query
- 桌面端/后端：Tauri 2、Rust、Axum、SQLite
- UI：Tailwind CSS 4、Lucide、Sonner、Framer Motion
- 测试：Node 内置 test runner

## 本地开发

安装依赖：

```bash
pnpm install
```

启动前端 + Rust HTTP 后端：

```bash
pnpm dev
```

默认地址：

- 前端：`http://localhost:1420`
- 后端：`http://localhost:3721`
- Web 开发模式下 Vite 会代理 `/api/*` 到后端
- 自定义后端端口时，给前后端使用同一个 `TXTX_PORT`，或为前端设置 `VITE_API_BASE`

也可以分开启动：

```bash
pnpm dev:frontend
pnpm dev:backend
```

启动 Tauri 桌面开发模式：

```bash
pnpm dev:tauri
```

Tauri 开发和打包会注入 `VITE_TAURI_MODE=true`，桌面包会走 Tauri invoke，而不是请求本地 HTTP 服务。

## 质量检查

提交前建议运行：

```bash
pnpm test
pnpm lint
pnpm format:check
pnpm build
pnpm build:tauri
pnpm check:rust
```

常用修复命令：

```bash
pnpm lint:fix
pnpm format
```

## 测试与性能注意事项

- `pnpm test` 运行 `src/**/*.test.ts`，新增嵌套测试目录会自动纳入。
- `pnpm check:rust` 同时检查 HTTP server 二进制和 Tauri feature 构建路径。
- 任务、历史、扫描预览、书架等列表功能要覆盖搜索、筛选、排序、空状态和错误提示。
- 不要让测试依赖真实网络、真实小说站点或用户本机目录。
- 历史页已经使用后端分页与统计，不要重新把全量历史搬到前端分页。
- 任务事件可能高频到达，前端应合并快照并避免每次事件都做昂贵重算。
- 新增大型依赖前先确认是否只在单页使用，必要时配合懒加载或动态加载。

## 目录说明

- [src](src)：前端页面、组件、状态和平台适配
- [src-tauri](src-tauri)：Tauri 命令、Rust HTTP 服务、下载逻辑、SQLite 历史与本地能力
- [docs/project-flow.md](docs/project-flow.md)：当前产品主流程与数据流
- [docs/plans](docs/plans)：历次规划与实施文档
- [DEV.md](DEV.md)：本地开发、验证和性能注意事项
- [PRODUCT.md](PRODUCT.md)：产品定位与语气约束

## 进一步阅读

- [开发指南](DEV.md)
- [项目流程梳理](docs/project-flow.md)

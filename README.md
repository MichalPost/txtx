# txtx

`txtx` 是一个本地单机小说下载工具。你输入小说链接，它负责扫描、筛选、下载、记录和整理，尽量安静地把内容放进本地书架。

## 功能概览

- 单本下载、批量导入、全站扫描预览
- 任务中心：查看扫描、确认、下载、失败与完成状态
- 规则管理：维护站点规则与抓取字段
- 过滤中心：管理广告、导航词和清洗策略
- 本地书架：浏览、打开、删除已下载书籍
- 下载历史：分页查询、统计图表、重新下载
- 文本转换：拆分、合并、编码处理与繁简转换
- 设置中心：路径、网络、并发、电子书、AI 与后处理配置

## 技术栈

- 前端：React 19、TypeScript、Vite、Zustand、TanStack Query
- 桌面端：Tauri 2、Rust、SQLite
- UI：Tailwind CSS 4、Lucide、Sonner、Framer Motion

## 本地开发

安装依赖：

```bash
pnpm install
```

启动前端 + 后端开发环境：

```bash
pnpm dev
```

只启动前端：

```bash
pnpm dev:frontend
```

只启动 Rust HTTP 后端：

```bash
pnpm dev:backend
```

启动 Tauri 桌面版开发：

```bash
pnpm dev:tauri
```

## 质量检查

运行测试：

```bash
pnpm test
```

运行 lint：

```bash
pnpm lint
```

构建前端产物：

```bash
pnpm build
```

校验 Tauri/Rust：

```bash
cargo check --manifest-path src-tauri/Cargo.toml --features tauri-build
```

## 目录说明

- [src](D:/Code/Node/txtx/src) 前端页面、组件、状态和平台适配
- [src-tauri](D:/Code/Node/txtx/src-tauri) Tauri 命令、下载逻辑、SQLite 历史与本地能力
- [docs/plans](D:/Code/Node/txtx/docs/plans) 历次规划与实施文档
- [PRODUCT.md](D:/Code/Node/txtx/PRODUCT.md) 产品定位与语气约束

## 当前重点

这次迭代重点补强了三件事：

- 修复高频页面的乱码文案与按钮辅助说明
- 给任务中心补上搜索、筛选、排序和摘要能力
- 把桌面端历史查询改成后端分页与统计，降低大数据量下的前端压力

同时，任务中心现在已经补上了关键状态快照与恢复能力：

- 扫描完成待确认、下载进行中、暂停、取消、失败、完成等关键状态会写入本地 SQLite
- 扫描预览页的勾选结果、站点筛选和排序草稿也会进入任务快照，桌面端重启后可继续确认下载
- 任务重试会尽量复用原始扫描参数和已选下载列表，避免重试语义漂移
- Tauri 端会在事件丢失时触发兜底刷新，降低任务列表与详情不同步的概率

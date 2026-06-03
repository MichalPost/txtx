# 本地开发指南

## 架构说明

```
┌─────────────────────────────────────────────────────┐
│  本地开发                                            │
│                                                     │
│  Terminal 1: cargo run --bin txtx-server            │
│              → http://localhost:3721                │
│                                                     │
│  Terminal 2: pnpm dev                               │
│              → http://localhost:1420                │
│              → /api/* 代理到 :3721                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  GitHub Actions (打包发布)                           │
│                                                     │
│  tauri-action 编译 Tauri 桌面应用                    │
│  VITE_TAURI_MODE=true → 前端走 invoke               │
│  --features tauri-build → 启用 Tauri 后端           │
└─────────────────────────────────────────────────────┘
```

## 本地开发步骤

### 1. 启动 Rust 后端

```bash
# 在 src-tauri 目录
cargo run --bin txtx-server

# 或者用 npm script（在 txtx-app 目录）
pnpm dev:backend
```

后端默认监听 `http://localhost:3721`，可通过环境变量修改端口：

```bash
TXTX_PORT=8080 cargo run --bin txtx-server
```

### 2. 启动前端

```bash
# 在 txtx-app 目录
pnpm dev
```

打开 http://localhost:1420，Vite 会自动把 `/api/*` 代理到后端。

---

## 发布打包

推送 `v*` tag 触发 GitHub Actions，自动编译 Windows / Linux / macOS 安装包：

```bash
git tag v0.1.0
git push origin v0.1.0
```

产物会作为 Draft Release 上传到 GitHub Releases。

---

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/config` | 读取配置 |
| PUT | `/api/config` | 保存配置 |
| GET (WS) | `/api/download` | 开始下载，WebSocket 推送进度 |
| POST | `/api/stop` | 停止下载 |

WebSocket 消息格式与 Tauri 事件 payload 完全一致（`ProgressEvent` 类型）。

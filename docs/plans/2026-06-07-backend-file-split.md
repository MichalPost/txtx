# Backend File Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 src-tauri/src 中行数过多的后端 Rust 文件拆分为更小、职责单一的模块，提高可维护性。

**Architecture:** 按职责边界拆分，每个文件聚焦一个功能领域。拆分只做移动和重组，不改逻辑。保持所有现有 pub API 不变，调用方无需修改（或最小修改）。

**Tech Stack:** Rust, Tauri, rusqlite, tokio, anyhow

---

## 文件现状（需拆分的目标）

| 文件 | 行数 | 问题 |
|------|------|------|
| `src/lib.rs` | 854 | 把所有 Tauri command 塞在一起 |
| `src/config_db.rs` | 718 | 混合了 migration、config CRUD、website CRUD、yaml 迁移 |
| `src/server/task_routes.rs` | 435 | scan/batch/single 三类任务逻辑混在一个文件 |
| `src/history.rs` | 309 | DB 层 + 业务查询 + 迁移逻辑混在一起 |
| `src/downloader/mod.rs` | 344 | 入口函数 + scan options + batch 调度混在一起 |
| `src/downloader/novel.rs` | 347 | 下载核心 + 修复 pass + merge + convert 混在一起 |
| `src/ttks_downloader.rs` | 337 | HTTP 客户端构建 + rate limiter + 章节抓取 + 内容过滤混在一起 |

---

## Task 1: 拆分 `config_db.rs`

**目标：** 把 718 行的 config_db.rs 拆为 3 个文件：
- `config_db/mod.rs` — 重新导出 pub API，保持对外接口不变
- `config_db/migrate.rs` — DB 创建、schema migration、yaml 迁移
- `config_db/websites.rs` — website 和 rate_limit_rules 的 CRUD

**Files:**
- Create: `src-tauri/src/config_db/mod.rs`
- Create: `src-tauri/src/config_db/migrate.rs`
- Create: `src-tauri/src/config_db/websites.rs`
- Delete: `src-tauri/src/config_db.rs`

**Step 1: 创建 `config_db/migrate.rs`**

移入以下函数（含 use 语句）：
- `fn open_db`
- `fn migrate`
- `fn migrate_ttks_to_rate_limit_rules`
- `pub fn is_first_run`
- `pub fn mark_setup_complete`
- `pub fn maybe_migrate_from_yaml`

函数签名全部保持不变，只是移动位置。

```rust
// src-tauri/src/config_db/migrate.rs
use std::path::{Path, PathBuf};
use anyhow::Result;
use rusqlite::Connection;
use crate::models::AppConfig;

pub(super) fn open_db(app_data_dir: &Path) -> Result<Connection> { ... }
pub(super) fn migrate(conn: &Connection) -> Result<()> { ... }
fn migrate_ttks_to_rate_limit_rules(conn: &Connection) -> Result<()> { ... }
pub fn is_first_run(app_data_dir: &Path) -> bool { ... }
pub fn mark_setup_complete(app_data_dir: &Path) -> Result<()> { ... }
pub fn maybe_migrate_from_yaml(app_data_dir: &Path) { ... }
```

**Step 2: 创建 `config_db/websites.rs`**

移入：
- `fn load_websites_inner`
- `fn save_all_websites_inner`
- `fn save_rate_limit_rules`
- `fn load_rate_limit_rules`

```rust
// src-tauri/src/config_db/websites.rs
use std::collections::HashMap;
use anyhow::Result;
use rusqlite::Connection;
use crate::models::{WebsiteConfig};
use crate::models::filters::RateLimitRule;

pub(super) fn load_websites_inner(conn: &Connection) -> Result<HashMap<String, WebsiteConfig>> { ... }
pub(super) fn save_all_websites_inner(...) -> Result<()> { ... }
pub(super) fn save_rate_limit_rules(conn: &Connection, rules: &[RateLimitRule]) -> Result<()> { ... }
pub(super) fn load_rate_limit_rules(conn: &Connection) -> Vec<RateLimitRule> { ... }
```

**Step 3: 创建 `config_db/mod.rs`**

保留原来的公开函数（`db_path`, `load_config`, `save_config`, `update_last_download_date`, `default_app_config`, `row_to_config`），并重新导出 migrate.rs 的 pub 函数：

```rust
// src-tauri/src/config_db/mod.rs
mod migrate;
mod websites;

pub use migrate::{is_first_run, mark_setup_complete, maybe_migrate_from_yaml};

use migrate::open_db;
use websites::{load_websites_inner, save_all_websites_inner, save_rate_limit_rules, load_rate_limit_rules};

// db_path, load_config, save_config, update_last_download_date, 
// default_app_config, row_to_config 留在此文件
```

**Step 4: 更新 `lib.rs` 中的 mod 声明**

```rust
// 原来：
pub mod config_db;
// 不用改——Rust 会自动找 config_db/mod.rs
```

**Step 5: 删除原 `config_db.rs`**

**Step 6: 编译验证**

```bash
cargo build -p txtx-lib 2>&1 | head -50
```
期望：0 errors。

**Step 7: Commit**

```
git add src-tauri/src/config_db/
git rm src-tauri/src/config_db.rs
git commit -m "refactor: split config_db.rs into migrate / websites submodules"
```

---

## Task 2: 拆分 `history.rs`

**目标：** 309 行 → 2 个文件
- `history/mod.rs` — 公开 API（load、query、append、clear、make_entry、stats）
- `history/db.rs` — DB 底层（open_db、migrate、maybe_migrate_json）

**Files:**
- Create: `src-tauri/src/history/mod.rs`
- Create: `src-tauri/src/history/db.rs`
- Delete: `src-tauri/src/history.rs`

**Step 1: 创建 `history/db.rs`**

移入：
- `fn db_path`
- `fn open_db`
- `fn migrate`
- `async fn maybe_migrate_json`

```rust
// src-tauri/src/history/db.rs
use std::path::{Path, PathBuf};
use anyhow::Result;
use rusqlite::Connection;
use super::HistoryEntry;

pub(super) fn db_path(base_dir: &Path) -> PathBuf { ... }
pub(super) fn open_db(base_dir: &Path) -> Result<Connection> { ... }
pub(super) fn migrate(conn: &Connection) -> Result<()> { ... }
pub(super) async fn maybe_migrate_json(base_dir: &Path) -> Result<()> { ... }
```

**Step 2: 创建 `history/mod.rs`**

保留所有 pub 结构体和公开函数，引用 db 子模块：

```rust
// src-tauri/src/history/mod.rs
mod db;
use db::{db_path, open_db, migrate, maybe_migrate_json};

// HistoryEntry, HistoryQuery, HistoryPage, DailyStat, SiteStat 结构体保留
// load_history, query_history, get_daily_stats, get_site_stats, 
// append_entry, clear_history, make_entry 函数保留
```

**Step 3: 删除原 `history.rs`**

**Step 4: 编译验证**

```bash
cargo build -p txtx-lib 2>&1 | head -50
```

**Step 5: Commit**

```
git add src-tauri/src/history/
git rm src-tauri/src/history.rs
git commit -m "refactor: split history.rs into mod/db submodules"
```

---

## Task 3: 拆分 `ttks_downloader.rs`

**目标：** 337 行 → 2 个文件
- `ttks_downloader/mod.rs` — 重新导出；`build_ttks_client`、`find_rate_limit_rule`、`fetch_ttks_chapter`
- `ttks_downloader/client.rs` — `TtksClient` enum、`build`、`pick_emulation`、`get_rate_limiter`、rate limiter 类型别名

**Files:**
- Create: `src-tauri/src/ttks_downloader/mod.rs`
- Create: `src-tauri/src/ttks_downloader/client.rs`
- Delete: `src-tauri/src/ttks_downloader.rs`

**Step 1: 创建 `ttks_downloader/client.rs`**

移入：
- `fn pick_emulation`
- `fn build`（TtksClient 的关联函数）
- `enum TtksClient`（含 `get_bytes`）
- `fn get_rate_limiter`
- 类型别名 `DirectRl`

```rust
// src-tauri/src/ttks_downloader/client.rs
use anyhow::Result;
// ... 相关 use

pub type DirectRl = governor::RateLimiter<...>;

pub enum TtksClient { ... }
pub fn get_rate_limiter(rps: u32) -> Option<std::sync::Arc<DirectRl>> { ... }
fn pick_emulation(ua: &str) -> Emulation { ... }
```

**Step 2: 创建 `ttks_downloader/mod.rs`**

保留 `build_ttks_client`、`find_rate_limit_rule`、`fetch_ttks_chapter`、`filter_ttks_content_with_config`，使用 `client` 子模块：

```rust
// src-tauri/src/ttks_downloader/mod.rs
pub mod client;
pub use client::{TtksClient, get_rate_limiter, DirectRl};

pub fn find_rate_limit_rule<'a>(...) -> ... { ... }
pub fn build_ttks_client(...) -> ... { ... }
pub async fn fetch_ttks_chapter(...) -> ... { ... }
fn filter_ttks_content_with_config(...) -> String { ... }
```

**Step 3: 删除原 `ttks_downloader.rs`**

**Step 4: 编译验证**

```bash
cargo build -p txtx-lib 2>&1 | head -50
```

**Step 5: Commit**

```
git add src-tauri/src/ttks_downloader/
git rm src-tauri/src/ttks_downloader.rs
git commit -m "refactor: split ttks_downloader.rs into client submodule"
```

---

## Task 4: 拆分 `downloader/novel.rs`

**目标：** 347 行 → 2 个文件
- `downloader/novel.rs` — 主下载入口 `download_novel`、`merge_chapters`
- `downloader/novel_pass.rs` — 具体 pass 逻辑：`run_first_pass`、`run_repair_pass`、`convert_ebook`

**Files:**
- Modify: `src-tauri/src/downloader/novel.rs`（删除 pass 函数）
- Create: `src-tauri/src/downloader/novel_pass.rs`

**Step 1: 创建 `novel_pass.rs`**

```rust
// src-tauri/src/downloader/novel_pass.rs
use anyhow::Result;
use std::path::Path;
use crate::models::AppConfig;
use crate::models::ProgressEvent;
use tokio::sync::mpsc;

pub(super) async fn run_first_pass(...) -> Result<usize> { ... }
pub(super) async fn run_repair_pass(...) -> Result<()> { ... }
pub(super) async fn convert_ebook(...) -> Result<()> { ... }
```

**Step 2: 更新 `novel.rs`**

在文件顶部加：
```rust
mod novel_pass;
use novel_pass::{run_first_pass, run_repair_pass, convert_ebook};
```
并删除已移走的函数体。

**Step 3: 编译验证**

```bash
cargo build -p txtx-lib 2>&1 | head -50
```

**Step 4: Commit**

```
git add src-tauri/src/downloader/
git commit -m "refactor: extract novel pass logic into novel_pass.rs"
```

---

## Task 5: 拆分 `downloader/mod.rs`

**目标：** 344 行 → 2 个文件
- `downloader/mod.rs` — 保留 `ScanOptions`、`run_download`、`run_download_selected`、`run_scan`、`run_scan_with_options` 的函数签名和入口
- `downloader/batch.rs` — 移入 `execute_download_batch`（最重的内部函数）及 `compute_target_date`

**Files:**
- Modify: `src-tauri/src/downloader/mod.rs`
- Create: `src-tauri/src/downloader/batch.rs`

**Step 1: 创建 `batch.rs`**

```rust
// src-tauri/src/downloader/batch.rs
use anyhow::Result;
use tokio::sync::{mpsc, Notify};
use std::sync::Arc;
use crate::models::{AppConfig, ProgressEvent};

pub(super) fn compute_target_date(cfg: &AppConfig) -> String { ... }
pub(super) async fn execute_download_batch(...) -> Result<()> { ... }
```

**Step 2: 更新 `mod.rs`**

```rust
mod batch;
use batch::{compute_target_date, execute_download_batch};
```

删除已移走的函数体。

**Step 3: 编译验证**

```bash
cargo build -p txtx-lib 2>&1 | head -50
```

**Step 4: Commit**

```
git add src-tauri/src/downloader/
git commit -m "refactor: extract batch download logic into downloader/batch.rs"
```

---

## Task 6: 拆分 `lib.rs` (Tauri commands)

**目标：** 854 行 → 5 个文件，`lib.rs` 降至 ~120 行
- `lib.rs` — 模块声明 + `run()` 函数
- `commands/config_commands.rs` — `load_config`, `save_config`, `check_first_run`, `complete_setup`, `pick_directory`, `fetch_source`
- `commands/task_commands.rs` — `create_scan_task`, `create_batch_download_task`, `create_single_download_task`, `confirm_task_download`, `list_tasks`, `get_task`, `cancel_task`, `pause_task`, `delete_task`, `load_persisted_tasks`, legacy shim commands
- `commands/misc_commands.rs` — `get_history`, `clear_history`, `check_sites`, `convert_file`, `get_queue`, `clear_queue`, `preview_novel_name`, `open_output_dir`, `list_books`, `delete_book`, `open_book`, `detect_calibre`
- `commands/ai_commands.rs` — `load_ai_config`, `save_ai_config`, `ai_extract`, `ai_complete`, `ai_stream_complete`
- `commands/worker.rs` — `spawn_task_worker` 帮助函数 + `app_data_dir` 工具函数

**Files:**
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/worker.rs`
- Create: `src-tauri/src/commands/config_commands.rs`
- Create: `src-tauri/src/commands/task_commands.rs`
- Create: `src-tauri/src/commands/misc_commands.rs`
- Create: `src-tauri/src/commands/ai_commands.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 `commands/worker.rs`**

把 `spawn_task_worker` 和 `app_data_dir` 移入，加上 pub(super) 可见性：

```rust
// src-tauri/src/commands/worker.rs
use std::sync::Arc;
use tokio::sync::{mpsc, Notify};
use tauri::{AppHandle, Emitter};
use crate::models::{ProgressEvent, TaskId, TaskEvent, TaskStatus};
use crate::task_manager::{SharedTaskManager, TaskManager};

pub(super) fn app_data_dir(app: &AppHandle) -> std::path::PathBuf {
    app.path().app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
}

pub(super) async fn spawn_task_worker<F, Fut>(
    app: AppHandle,
    tm: SharedTaskManager,
    task_id: TaskId,
    future_factory: F,
) where
    F: FnOnce(mpsc::Sender<ProgressEvent>) -> Fut + Send + 'static,
    Fut: std::future::Future<Output = anyhow::Result<()>> + Send + 'static,
{ ... }
```

**Step 2: 创建 `commands/config_commands.rs`**

```rust
// src-tauri/src/commands/config_commands.rs
use tauri::AppHandle;
use super::worker::app_data_dir;

#[tauri::command]
pub async fn load_config(app: AppHandle) -> Result<crate::models::AppConfig, String> { ... }

#[tauri::command]
pub async fn save_config(app: AppHandle, config: crate::models::AppConfig) -> Result<(), String> { ... }

#[tauri::command]
pub async fn check_first_run(app: AppHandle) -> bool { ... }

#[tauri::command]
pub async fn complete_setup(app: AppHandle, base_dir: String) -> Result<(), String> { ... }

#[tauri::command]
pub async fn pick_directory(app: AppHandle) -> Result<Option<String>, String> { ... }

#[tauri::command]
pub async fn fetch_source(app: AppHandle, url: String) -> Result<String, String> { ... }
```

**Step 3: 创建 `commands/task_commands.rs`**

把任务相关的所有 `#[tauri::command]` 函数移入（包含 legacy shim）。

```rust
// src-tauri/src/commands/task_commands.rs
use std::sync::Arc;
use tokio::sync::Notify;
use tauri::{AppHandle, State};
use crate::models::{TaskId, TaskKind, TaskRecord, TaskStatus};
use crate::task_manager::{SharedTaskManager, TaskManager};
use super::worker::{app_data_dir, spawn_task_worker};

#[tauri::command]
pub async fn create_scan_task(...) -> Result<TaskId, String> { ... }
// ... 其余函数
```

**Step 4: 创建 `commands/misc_commands.rs`**

```rust
// src-tauri/src/commands/misc_commands.rs
use tauri::AppHandle;
use super::worker::app_data_dir;

#[tauri::command]
pub async fn get_history(app: AppHandle) -> Result<Vec<crate::history::HistoryEntry>, String> { ... }
// ... 其余函数
```

**Step 5: 创建 `commands/ai_commands.rs`**

```rust
// src-tauri/src/commands/ai_commands.rs
use tauri::AppHandle;
use super::worker::app_data_dir;

#[tauri::command]
pub async fn load_ai_config(app: AppHandle) -> Result<crate::ai_config_db::AiMultiConfig, String> { ... }
// ... 其余函数
```

**Step 6: 创建 `commands/mod.rs`**

```rust
// src-tauri/src/commands/mod.rs
pub mod worker;
pub mod config_commands;
pub mod task_commands;
pub mod misc_commands;
pub mod ai_commands;

// Re-export all commands for use in generate_handler!
pub use config_commands::*;
pub use task_commands::*;
pub use misc_commands::*;
pub use ai_commands::*;
```

**Step 7: 更新 `lib.rs`**

```rust
// src-tauri/src/lib.rs（精简后约 120 行）
pub mod models;
pub mod config;
pub mod config_db;
pub mod ai;
pub mod ai_config_db;
pub mod blacklist;
pub mod bookshelf;
pub mod crawler;
pub mod downloader;
pub mod server;
pub mod text_converter;
pub mod ebook_converter;
pub mod history;
pub mod task_manager;
pub mod single_downloader;
pub mod ttks_downloader;

#[cfg(debug_assertions)]
pub mod dev_tools;
pub mod kumo_scanner;

#[cfg(feature = "tauri-build")]
mod tauri_app {
    pub mod commands;  // <-- 新增

    use std::sync::Arc;
    use tokio::sync::Mutex;
    use tauri::Manager;
    use crate::task_manager::{TaskManager, SharedTaskManager};
    use commands::*;

    pub fn run() {
        let task_manager: SharedTaskManager =
            Arc::new(Mutex::new(TaskManager::new(std::path::PathBuf::from("."))));

        tauri::Builder::default()
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_fs::init())
            .manage(task_manager)
            .setup(|app| {
                // 初始化 base_dir ...
                Ok(())
            })
            .invoke_handler(tauri::generate_handler![
                load_config, save_config, check_first_run, complete_setup,
                pick_directory, fetch_source,
                create_scan_task, create_batch_download_task, create_single_download_task,
                confirm_task_download, list_tasks, get_task, cancel_task, pause_task,
                delete_task, load_persisted_tasks,
                start_scan, download_selected, start_download, stop_download, download_single,
                get_history, clear_history, check_sites, convert_file,
                get_queue, clear_queue, preview_novel_name, open_output_dir,
                list_books, delete_book, open_book, detect_calibre,
                ai_complete, ai_stream_complete, ai_extract, load_ai_config, save_ai_config,
            ])
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }
}

#[cfg(feature = "tauri-build")]
pub use tauri_app::run;
```

**Step 8: 编译验证**

```bash
cargo build -p txtx-lib 2>&1 | head -80
```

**Step 9: Commit**

```
git add src-tauri/src/commands/ src-tauri/src/lib.rs
git commit -m "refactor: extract Tauri commands into commands/ module"
```

---

## Task 7: 拆分 `server/task_routes.rs`（可选，优先级低）

**目标：** 435 行 → 3 个文件（仅在服务端路由模式下使用，优先级低于其他 Task）
- `server/task_routes/mod.rs` — 注册路由（`router()` 函数）
- `server/task_routes/scan.rs` — `post_scan_task`（最重，~90 行业务逻辑）
- `server/task_routes/download.rs` — `post_batch_task`、`post_single_task`、`post_confirm_task`
- `server/task_routes/manage.rs` — `get_tasks`、`get_task`、`post_cancel_task`、`post_pause_task`、`delete_task`

**Files:**
- Create: `src-tauri/src/server/task_routes/mod.rs`
- Create: `src-tauri/src/server/task_routes/scan.rs`
- Create: `src-tauri/src/server/task_routes/download.rs`
- Create: `src-tauri/src/server/task_routes/manage.rs`
- Delete: `src-tauri/src/server/task_routes.rs`

**Step 1: 创建 `task_routes/manage.rs`**

移入所有简单的任务管理端点（不涉及任务创建逻辑）：

```rust
// src-tauri/src/server/task_routes/manage.rs
use axum::{extract::{Path, State}, Json};
use crate::models::{TaskId, TaskRecord, TaskStatus};
use crate::server::state::AppState;
use crate::task_manager::SharedTaskManager;

pub async fn get_tasks(State(state): State<AppState>) -> Json<Vec<TaskRecord>> { ... }
pub async fn get_task(State(state): State<AppState>, Path(id): Path<TaskId>) -> ... { ... }
pub async fn post_cancel_task(...) -> ... { ... }
pub async fn post_pause_task(...) -> ... { ... }
pub async fn delete_task(...) -> ... { ... }
```

**Step 2: 创建 `task_routes/scan.rs`**

```rust
// src-tauri/src/server/task_routes/scan.rs
use axum::{extract::State, Json};
use serde::Deserialize;
use crate::server::state::AppState;
use crate::models::TaskId;

#[derive(Deserialize)]
pub struct ScanTaskBody { ... }

pub async fn post_scan_task(State(state): State<AppState>, Json(body): Json<ScanTaskBody>) -> ... { ... }
```

**Step 3: 创建 `task_routes/download.rs`**

```rust
// src-tauri/src/server/task_routes/download.rs
pub async fn post_batch_task(...) -> ... { ... }
pub async fn post_single_task(...) -> ... { ... }
pub async fn post_confirm_task(...) -> ... { ... }
```

**Step 4: 创建 `task_routes/mod.rs`**

```rust
// src-tauri/src/server/task_routes/mod.rs
pub mod manage;
pub mod scan;
pub mod download;

pub use manage::*;
pub use scan::*;
pub use download::*;
```

更新 `server/mod.rs` 中的路由注册，保持引用路径不变。

**Step 5: 删除原 `task_routes.rs`**

**Step 6: 编译验证**

```bash
cargo build -p txtx-lib 2>&1 | head -50
```

**Step 7: Commit**

```
git add src-tauri/src/server/task_routes/
git rm src-tauri/src/server/task_routes.rs
git commit -m "refactor: split task_routes.rs into scan/download/manage submodules"
```

---

## 执行顺序总结

1. **Task 1** — `config_db.rs`（718 行，基础层，其他 Task 依赖它）
2. **Task 2** — `history.rs`（309 行，独立，无依赖）
3. **Task 3** — `ttks_downloader.rs`（337 行，独立，无依赖）
4. **Task 4** — `downloader/novel.rs`（347 行，依赖 ttks_downloader）
5. **Task 5** — `downloader/mod.rs`（344 行，依赖 novel.rs）
6. **Task 6** — `lib.rs`（854 行，最重要，最后做，依赖前面都稳定）
7. **Task 7** — `server/task_routes.rs`（435 行，可选，独立于 Tauri 侧）

> 每个 Task 完成后都执行 `cargo build` 确认零 error，再 commit。不要攒多个 Task 再编译。

## 验收标准

- `cargo build` 零 error、零 warning（或 warning 数不增加）
- 所有 public API 路径不变（`crate::config_db::load_config` 等仍然可访问）
- `lib.rs` 降至 ≤150 行
- `config_db.rs` 消失，替换为 `config_db/` 目录
- `history.rs` 消失，替换为 `history/` 目录
- `ttks_downloader.rs` 消失，替换为 `ttks_downloader/` 目录
- Tauri commands 按功能域分组到 `commands/` 下

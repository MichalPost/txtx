# Rust 模块拆分重构计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `server.rs`、`crawler.rs`、`models.rs` 三个文件按功能域拆分成更小的子模块，降低单文件复杂度并提升可维护性。

**Architecture:** 每个大文件拆出子模块目录（`server/`、`crawler/`、`models/`），原文件保留为 `mod.rs` 聚合入口，对外 `pub use` 保证调用方零改动。无业务逻辑变更，纯结构性重构。

**Tech Stack:** Rust, Axum, Tokio, reqwest, scraper, sxd-xpath

---

## 拆分总览

| 原文件 | 新子模块 | 行数变化 |
|--------|---------|---------|
| `models.rs` (439 行) | `models/config.rs`, `models/runtime.rs`, `models/conversion.rs`, `models/filters.rs` | 各 ~80-120 行 |
| `crawler.rs` (517 行) | `crawler/http_client.rs`, `crawler/xpath_parser.rs`, `crawler/content_optimizer.rs`, `crawler/filename_utils.rs`, `crawler/domain_utils.rs` | 各 ~60-120 行 |
| `server.rs` (560 行) | `server/state.rs`, `server/error.rs`, `server/config.rs`, `server/download.rs`, `server/history.rs`, `server/health.rs`, `server/convert.rs`, `server/queue.rs`, `server/novel.rs` | 各 ~30-80 行 |

---

## Task 1: 拆分 `models.rs`

**Files:**
- Create: `txtx-app/src-tauri/src/models/config.rs`
- Create: `txtx-app/src-tauri/src/models/runtime.rs`
- Create: `txtx-app/src-tauri/src/models/conversion.rs`
- Create: `txtx-app/src-tauri/src/models/filters.rs`
- Modify: `txtx-app/src-tauri/src/models.rs` → 转为 `models/mod.rs`

### Step 1: 创建 `models/config.rs`

内容：所有配置结构体及其 `Default` 实现。

```rust
// src-tauri/src/models/config.rs
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub(crate) fn default_true() -> bool { true }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathsConfig { /* ... */ }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig { /* ... */ }
// ... (其余配置结构体，见 models.rs 中 ─── Config ─── 到 ─── Runtime types ─── 之间的全部内容)
```

### Step 2: 创建 `models/runtime.rs`

内容：`BookCandidate`, `DownloadStats`, `SiteHealth`, `ScanItem`, `ProgressEvent`。

### Step 3: 创建 `models/conversion.rs`

内容：`TextConversionConfig`, `EbookConversionConfig`。

### Step 4: 创建 `models/filters.rs`

内容：`ContentFilterConfig`, `TtksConfig`, `AdvancedNetworkConfig`（含所有 `default_*` 辅助函数）。

### Step 5: 将 `models.rs` 转为 `models/mod.rs`

`mod.rs` 只保留 `mod` 声明和 `pub use` 重导出：

```rust
// src-tauri/src/models/mod.rs
pub mod config;
pub mod conversion;
pub mod filters;
pub mod runtime;

pub use config::*;
pub use conversion::*;
pub use filters::*;
pub use runtime::*;
```

### Step 6: 删除原 `models.rs`，移动到 `models/mod.rs`

> 注意：Rust 不允许同时存在 `models.rs` 和 `models/` 目录，因此需先删除 `models.rs`，再创建 `models/mod.rs`。

### Step 7: 编译验证

```
cd txtx-app/src-tauri
cargo check
```

期望：零错误。如有 `default_true` 重复定义，在 `config.rs` 中声明为 `pub(crate)`，其他子模块用 `use crate::models::config::default_true`。

### Step 8: 提交

```
git add src-tauri/src/models/
git add src-tauri/src/models.rs   # 删除
git commit -m "refactor: split models.rs into models/ submodules"
```

---

## Task 2: 拆分 `crawler.rs`

**Files:**
- Create: `txtx-app/src-tauri/src/crawler/domain_utils.rs`
- Create: `txtx-app/src-tauri/src/crawler/http_client.rs`
- Create: `txtx-app/src-tauri/src/crawler/xpath_parser.rs`
- Create: `txtx-app/src-tauri/src/crawler/content_optimizer.rs`
- Create: `txtx-app/src-tauri/src/crawler/filename_utils.rs`
- Modify: `txtx-app/src-tauri/src/crawler.rs` → 转为 `crawler/mod.rs`

### Step 1: 创建 `crawler/domain_utils.rs`

提取 `extract_domain` 和 `extract_domain_pub`：

```rust
// src-tauri/src/crawler/domain_utils.rs

pub fn extract_domain(url: &str) -> String {
    url.split("://")
        .nth(1)
        .unwrap_or("")
        .split('/')
        .next()
        .unwrap_or("")
        .to_string()
}

pub fn extract_domain_pub(url: &str) -> String {
    extract_domain(url)
}
```

### Step 2: 创建 `crawler/http_client.rs`

提取 `build_client`, `build_client_with_pool`, `fetch_page`。

imports 需要：
```rust
use std::collections::HashMap;
use anyhow::Result;
use backon::{ExponentialBuilder, Retryable};
use reqwest::Client;
use encoding_rs::Encoding;
use crate::models::NetworkConfig;
use super::domain_utils::extract_domain;
```

### Step 3: 创建 `crawler/xpath_parser.rs`

提取所有 XPath 相关函数：`xpath_texts`, `xpath_texts_pub`, `xpath_texts_native`,
`xpath_attr`（私有）, `strip_xpath_suffix`（私有）, `xpath_part_to_css`（私有）, `xpath_to_css`。

imports 需要：
```rust
use scraper::{Html, Selector};
use sxd_xpath::evaluate_xpath;
```

### Step 4: 创建 `crawler/filename_utils.rs`

提取 `sanitize_filename`：

```rust
// src-tauri/src/crawler/filename_utils.rs
pub fn sanitize_filename(name: &str) -> String { /* ... */ }
```

### Step 5: 创建 `crawler/content_optimizer.rs`

提取 `optimize_content`（可保持 `pub(crate)` 可见性，仅 `download_chapter` 内部调用）：

```rust
// src-tauri/src/crawler/content_optimizer.rs
use regex::Regex;
use crate::models::ContentFilterConfig;

pub(crate) fn optimize_content(parts: Vec<String>, filter: &ContentFilterConfig) -> String { /* ... */ }
```

### Step 6: 转换 `crawler.rs` 为 `crawler/mod.rs`

`mod.rs` 保留核心业务函数：`scan_site`, `fetch_novel_name`, `get_chapter_urls`,
`download_chapter`, `check_site_health`，并重导出公共 API：

```rust
// src-tauri/src/crawler/mod.rs
pub mod domain_utils;
pub mod http_client;
pub mod xpath_parser;
pub mod filename_utils;
pub(crate) mod content_optimizer;

// 重导出保持调用方兼容
pub use domain_utils::extract_domain_pub;
pub use http_client::{build_client, build_client_with_pool, fetch_page};
pub use xpath_parser::{xpath_texts_pub, xpath_texts_native};
pub use filename_utils::sanitize_filename;

use std::collections::HashMap;
use anyhow::Result;
use reqwest::Client;
use crate::models::{WebsiteConfig, NetworkConfig, BookCandidate, AppConfig, SiteHealth, ContentFilterConfig};

pub async fn scan_site(...) { ... }
pub async fn fetch_novel_name(...) { ... }
pub async fn get_chapter_urls(...) { ... }
pub async fn download_chapter(...) { ... }
pub async fn check_site_health(...) { ... }
```

### Step 7: 删除原 `crawler.rs`，检查其他引用

其他文件可能引用 `crate::crawler::xxx`，保证 `mod.rs` 全部重导出后无需修改。
检查命令：

```
grep -r "crate::crawler::" src-tauri/src/ --include="*.rs"
```

### Step 8: 编译验证

```
cargo check
```

期望：零错误。注意 `xpath_texts` 私有函数在 `mod.rs` 中可通过 `super::xpath_parser::xpath_texts` 调用。

### Step 9: 提交

```
git add src-tauri/src/crawler/
git commit -m "refactor: split crawler.rs into crawler/ submodules"
```

---

## Task 3: 拆分 `server.rs`

**Files:**
- Create: `txtx-app/src-tauri/src/server/state.rs`
- Create: `txtx-app/src-tauri/src/server/error.rs`
- Create: `txtx-app/src-tauri/src/server/config_routes.rs`
- Create: `txtx-app/src-tauri/src/server/download_routes.rs`
- Create: `txtx-app/src-tauri/src/server/history_routes.rs`
- Create: `txtx-app/src-tauri/src/server/health_routes.rs`
- Create: `txtx-app/src-tauri/src/server/convert_routes.rs`
- Create: `txtx-app/src-tauri/src/server/queue_routes.rs`
- Create: `txtx-app/src-tauri/src/server/novel_routes.rs`
- Modify: `txtx-app/src-tauri/src/server.rs` → 转为 `server/mod.rs`

### Step 1: 创建 `server/state.rs`

```rust
// src-tauri/src/server/state.rs
use std::sync::Arc;
use tokio::sync::{Mutex, Notify};

pub struct DownloadState {
    pub cancel: Arc<Notify>,
    pub running: bool,
}

pub type SharedDownloadState = Arc<Mutex<DownloadState>>;

#[derive(Clone)]
pub struct AppState {
    pub download: SharedDownloadState,
}
```

### Step 2: 创建 `server/error.rs`

```rust
// src-tauri/src/server/error.rs
use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;

pub struct AppError(pub anyhow::Error);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (StatusCode::INTERNAL_SERVER_ERROR,
         Json(json!({ "error": self.0.to_string() }))).into_response()
    }
}

impl<E: Into<anyhow::Error>> From<E> for AppError {
    fn from(e: E) -> Self { AppError(e.into()) }
}
```

### Step 3: 创建 `server/config_routes.rs`

提取 `get_config`, `put_config`。需要导入：
```rust
use super::{state::AppState, error::AppError};
use axum::Json;
use crate::{config, models::AppConfig};
use serde_json::json;
```

### Step 4: 创建 `server/download_routes.rs`

提取所有下载相关：`post_stop`, `ws_download` + `handle_ws`, `ws_single` + `handle_ws_single`,
`ws_scan` + `handle_ws_scan`, `ws_download_selected` + `handle_ws_download_selected`。

这是最大的子模块，约 300 行。所有 WebSocket 逻辑集中于此。

### Step 5: 创建 `server/history_routes.rs`

提取 `get_history`, `get_history_page`, `get_history_stats`, `delete_history`。

### Step 6: 创建 `server/health_routes.rs`

提取 `get_health`（约 6 行）。

### Step 7: 创建 `server/convert_routes.rs`

提取 `post_convert_text`。

### Step 8: 创建 `server/queue_routes.rs`

提取 `get_queue`, `delete_queue`。

### Step 9: 创建 `server/novel_routes.rs`

提取 `get_novel_name`, `post_open_dir`。

### Step 10: 转换 `server.rs` 为 `server/mod.rs`

`mod.rs` 只保留路由组装和 `run_server`：

```rust
// src-tauri/src/server/mod.rs
pub mod config_routes;
pub mod convert_routes;
pub mod download_routes;
pub mod error;
pub mod health_routes;
pub mod history_routes;
pub mod novel_routes;
pub mod queue_routes;
pub mod state;

use std::sync::Arc;
use axum::{routing::{get, post}, Router};
use tokio::sync::{Mutex, Notify};
use tower_http::cors::{Any, CorsLayer};

use state::{AppState, DownloadState, SharedDownloadState};
use config_routes::{get_config, put_config};
use download_routes::{post_stop, ws_download, ws_single, ws_scan, ws_download_selected};
use history_routes::{get_history, get_history_page, get_history_stats, delete_history};
use health_routes::get_health;
use convert_routes::post_convert_text;
use queue_routes::{get_queue, delete_queue};
use novel_routes::{get_novel_name, post_open_dir};

pub async fn run_server() {
    // ... 路由组装，与原 run_server 完全相同
}
```

### Step 11: 编译验证

```
cargo check
```

检查点：
- `AppState` 需要 `Clone`（已有），各 handler 中的 `State<AppState>` 仍正常。
- `AppError` 在各 route 模块中通过 `use super::error::AppError` 引入。

### Step 12: 提交

```
git add src-tauri/src/server/
git commit -m "refactor: split server.rs into server/ submodules"
```

---

## Task 4: 最终验证

### Step 1: 完整构建

```
cd txtx-app
cargo tauri build --debug
```

或在仅验证逻辑时：
```
cd txtx-app/src-tauri
cargo check --all-targets
```

### Step 2: 确认文件行数符合预期

```powershell
Get-ChildItem src-tauri/src/models/, src-tauri/src/crawler/, src-tauri/src/server/ -Recurse -Filter "*.rs" | ForEach-Object { $c = (Get-Content $_).Count; "$c`t$($_.Name)" } | Sort-Object
```

期望：所有文件均 < 200 行。

### Step 3: 提交总结

```
git commit --allow-empty -m "refactor: rust module split complete (server/crawler/models)"
```

---

## 注意事项

1. **可见性**：私有辅助函数（`xpath_attr`、`strip_xpath_suffix`、`xpath_part_to_css`、`optimize_content`）在子模块内保持 `fn` 或 `pub(crate)`，不对外暴露。

2. **`default_true` 函数**：`models.rs` 中有多处使用，拆分后在 `config.rs` 中保留为 `pub(crate) fn default_true()`，其余子模块通过 `use crate::models::config::default_true` 引入。

3. **不需要改动的文件**：`lib.rs`, `server_main.rs`, `downloader/`, `blacklist.rs`, `config.rs`, `history.rs` 等均无需修改，因为通过 `pub use` 重导出保持了外部 API 兼容。

4. **执行顺序**：先拆 `models`（被其他文件 use），再拆 `crawler`（被 server 和 downloader use），最后拆 `server`（只被 server_main 调用）。

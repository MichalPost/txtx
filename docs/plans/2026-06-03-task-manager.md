# Task Manager Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-slot download state with a full multi-task manager supporting concurrent tasks, per-task progress tracking, pause/resume, and a rich task list UI.

**Architecture:** Backend introduces a `TaskManager` (HashMap of TaskRecord + cancel handles) replacing the single `SharedDownloadState`. Each task gets a UUID, emits `task_event` with `task_id`. Frontend introduces `taskStore` that fans out events by task_id, and a new `TaskManagerPage` with split task list + detail panels.

**Tech Stack:** Rust/Tauri (tokio, uuid, rusqlite), React/TypeScript (zustand, @tanstack/react-query, lucide-react, tailwind)

---

## Overview of Changes

### Backend files to create
- `src-tauri/src/task_manager/mod.rs` — TaskManager, TaskRecord, TaskId types
- `src-tauri/src/task_manager/db.rs` — SQLite persistence for task sessions

### Backend files to modify
- `src-tauri/src/models/runtime.rs` — add TaskEvent wrapper with task_id
- `src-tauri/src/lib.rs` — replace SharedDownloadState with SharedTaskManager, new commands
- `src-tauri/src/server/state.rs` — update AppState
- `src-tauri/src/downloader/mod.rs` — accept task_id in execute_download_batch
- `src-tauri/src/Cargo.toml` — add uuid crate

### Frontend files to create
- `src/store/taskStore.ts` — replaces downloadStore for task management
- `src/store/taskEventHandler.ts` — fan-out handler per task_id
- `src/pages/tasks/TaskManagerPage.tsx` — main page
- `src/pages/tasks/TaskListPanel.tsx` — left sidebar task list
- `src/pages/tasks/TaskDetailPanel.tsx` — right panel, switches by task phase
- `src/pages/tasks/TaskListItem.tsx` — single task row component
- `src/lib/api/tasks.ts` — Tauri/HTTP API wrappers for task commands

### Frontend files to modify
- `src/App.tsx` — add /tasks route, keep /download as legacy
- `src/components/Sidebar.tsx` — add Tasks nav item
- `src/types/index.ts` — add TaskRecord, TaskKind, TaskStatus, TaskEvent types

---

## Task 1: Add uuid to Cargo.toml and define backend types

**Files:**
- Modify: `txtx-app/src-tauri/Cargo.toml`
- Modify: `txtx-app/src-tauri/src/models/runtime.rs`

**Step 1: Add uuid dependency to Cargo.toml**

In `[dependencies]` section, add:
```toml
uuid = { version = "1", features = ["v4"] }
```

**Step 2: Add TaskEvent wrapper to models/runtime.rs**

Append to the end of `models/runtime.rs`:
```rust
// ─── Task Manager Types ───────────────────────────────────────────────────────

pub type TaskId = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TaskKind {
    FullScan,
    BatchDownload,
    SelectedDownload,
    SingleDownload,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Queued,
    Scanning,
    Preview,
    Downloading,
    Paused,
    Done,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRecord {
    pub id: TaskId,
    pub kind: TaskKind,
    pub status: TaskStatus,
    pub label: String,
    pub created_at: String,
    pub finished_at: Option<String>,
    pub total: usize,
    pub completed: usize,
    pub success_count: usize,
    pub error_count: usize,
    pub scan_items: Vec<ScanItem>,
    pub scan_stats: Option<DownloadStats>,
    pub stats: Option<DownloadStats>,
    pub error_message: Option<String>,
}

/// Wraps any ProgressEvent with its owning task_id for frontend fan-out
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskEvent {
    pub task_id: TaskId,
    #[serde(flatten)]
    pub event: ProgressEvent,
}
```

**Step 3: Verify compilation**
```
cd txtx-app/src-tauri
cargo check 2>&1
```
Expected: no errors (new types compile cleanly)

**Step 4: Commit**
```
git add txtx-app/src-tauri/Cargo.toml txtx-app/src-tauri/src/models/runtime.rs
git commit -m "feat(backend): add task manager types to models"
```

---

## Task 2: Create TaskManager module

**Files:**
- Create: `txtx-app/src-tauri/src/task_manager/mod.rs`
- Create: `txtx-app/src-tauri/src/task_manager/db.rs`
- Modify: `txtx-app/src-tauri/src/lib.rs` (add `pub mod task_manager;`)

**Step 1: Create `src/task_manager/db.rs`**

```rust
/// Persist task sessions to SQLite (same DB as history, new table)
use std::path::Path;
use anyhow::Result;
use rusqlite::{Connection, params};
use crate::models::{TaskRecord, TaskKind, TaskStatus, ScanItem, DownloadStats};

fn open_db(base_dir: &Path) -> Result<Connection> {
    let path = base_dir.join("download_history.db");
    let conn = Connection::open(&path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS task_sessions (
            id              TEXT PRIMARY KEY,
            kind            TEXT NOT NULL,
            status          TEXT NOT NULL,
            label           TEXT NOT NULL,
            created_at      TEXT NOT NULL,
            finished_at     TEXT,
            total           INTEGER DEFAULT 0,
            completed       INTEGER DEFAULT 0,
            success_count   INTEGER DEFAULT 0,
            error_count     INTEGER DEFAULT 0,
            stats_json      TEXT,
            scan_items_json TEXT,
            scan_stats_json TEXT,
            error_message   TEXT
        );"
    )?;
    Ok(())
}
```

**Step 2: Add save/load/list functions to db.rs**

```rust
pub async fn save_task(base_dir: &Path, task: &TaskRecord) -> Result<()> {
    let base_dir = base_dir.to_path_buf();
    let task = task.clone();
    tokio::task::spawn_blocking(move || {
        let conn = open_db(&base_dir)?;
        let stats_json = task.stats.as_ref().map(|s| serde_json::to_string(s).ok()).flatten();
        let scan_items_json = if task.scan_items.is_empty() { None }
            else { serde_json::to_string(&task.scan_items).ok() };
        let scan_stats_json = task.scan_stats.as_ref()
            .map(|s| serde_json::to_string(s).ok()).flatten();
        let kind = serde_json::to_string(&task.kind)?.trim_matches('"').to_string();
        let status = serde_json::to_string(&task.status)?.trim_matches('"').to_string();
        conn.execute(
            "INSERT OR REPLACE INTO task_sessions
             (id,kind,status,label,created_at,finished_at,total,completed,
              success_count,error_count,stats_json,scan_items_json,scan_stats_json,error_message)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
            params![
                task.id, kind, status, task.label, task.created_at, task.finished_at,
                task.total as i64, task.completed as i64,
                task.success_count as i64, task.error_count as i64,
                stats_json, scan_items_json, scan_stats_json, task.error_message
            ],
        )?;
        Ok::<_, anyhow::Error>(())
    }).await??;
    Ok(())
}

pub async fn load_all_tasks(base_dir: &Path) -> Result<Vec<TaskRecord>> {
    let base_dir = base_dir.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let conn = open_db(&base_dir)?;
        let mut stmt = conn.prepare(
            "SELECT id,kind,status,label,created_at,finished_at,total,completed,
                    success_count,error_count,stats_json,scan_items_json,scan_stats_json,error_message
             FROM task_sessions ORDER BY created_at DESC LIMIT 100"
        )?;
        let tasks = stmt.query_map([], |row| {
            let kind_str: String = row.get(1)?;
            let status_str: String = row.get(2)?;
            Ok((
                row.get::<_,String>(0)?,  // id
                kind_str, status_str,
                row.get::<_,String>(3)?,  // label
                row.get::<_,String>(4)?,  // created_at
                row.get::<_,Option<String>>(5)?,  // finished_at
                row.get::<_,i64>(6)? as usize,    // total
                row.get::<_,i64>(7)? as usize,    // completed
                row.get::<_,i64>(8)? as usize,    // success_count
                row.get::<_,i64>(9)? as usize,    // error_count
                row.get::<_,Option<String>>(10)?, // stats_json
                row.get::<_,Option<String>>(11)?, // scan_items_json
                row.get::<_,Option<String>>(12)?, // scan_stats_json
                row.get::<_,Option<String>>(13)?, // error_message
            ))
        })?.filter_map(|r| r.ok()).map(|t| {
            let kind: TaskKind = serde_json::from_str(&format!("\"{}\"", t.1))
                .unwrap_or(TaskKind::BatchDownload);
            let status: TaskStatus = serde_json::from_str(&format!("\"{}\"", t.2))
                .unwrap_or(TaskStatus::Done);
            let stats: Option<DownloadStats> = t.10.as_ref()
                .and_then(|s| serde_json::from_str(s).ok());
            let scan_items: Vec<ScanItem> = t.11.as_ref()
                .and_then(|s| serde_json::from_str(s).ok()).unwrap_or_default();
            let scan_stats: Option<DownloadStats> = t.12.as_ref()
                .and_then(|s| serde_json::from_str(s).ok());
            TaskRecord {
                id: t.0, kind, status, label: t.3,
                created_at: t.4, finished_at: t.5,
                total: t.6, completed: t.7,
                success_count: t.8, error_count: t.9,
                stats, scan_items, scan_stats,
                error_message: t.13,
            }
        }).collect();
        Ok(tasks)
    }).await?
}
```

**Step 3: Create `src/task_manager/mod.rs`**

```rust
pub mod db;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{Mutex, Notify};
use chrono::Local;
use uuid::Uuid;

use crate::models::{TaskId, TaskKind, TaskRecord, TaskStatus};

pub struct TaskHandle {
    pub record: TaskRecord,
    pub cancel: Arc<Notify>,
}

pub struct TaskManager {
    pub handles: HashMap<TaskId, TaskHandle>,
    pub base_dir: PathBuf,
    pub max_concurrent: usize,  // default 3
}

impl TaskManager {
    pub fn new(base_dir: PathBuf) -> Self {
        Self { handles: HashMap::new(), base_dir, max_concurrent: 3 }
    }

    pub fn new_task_id() -> TaskId {
        Uuid::new_v4().to_string()
    }

    pub fn running_count(&self) -> usize {
        self.handles.values().filter(|h| {
            matches!(h.record.status,
                TaskStatus::Scanning | TaskStatus::Downloading | TaskStatus::Preview)
        }).count()
    }

    pub fn get_record(&self, id: &str) -> Option<&TaskRecord> {
        self.handles.get(id).map(|h| &h.record)
    }

    pub fn list_records(&self) -> Vec<TaskRecord> {
        let mut records: Vec<TaskRecord> = self.handles.values()
            .map(|h| h.record.clone()).collect();
        records.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        records
    }

    pub fn upsert(&mut self, record: TaskRecord, cancel: Arc<Notify>) {
        self.handles.insert(record.id.clone(), TaskHandle { record, cancel });
    }

    pub fn update_record<F>(&mut self, id: &str, f: F) -> bool
    where F: FnOnce(&mut TaskRecord)
    {
        if let Some(h) = self.handles.get_mut(id) {
            f(&mut h.record);
            true
        } else { false }
    }

    pub fn cancel_task(&self, id: &str) -> bool {
        if let Some(h) = self.handles.get(id) {
            h.cancel.notify_waiters();
            true
        } else { false }
    }

    pub fn remove_task(&mut self, id: &str) -> bool {
        if let Some(h) = self.handles.get(id) {
            h.cancel.notify_waiters();
        }
        self.handles.remove(id).is_some()
    }

    pub fn make_label(kind: &TaskKind, extra: &str) -> String {
        let prefix = match kind {
            TaskKind::FullScan => "扫描",
            TaskKind::BatchDownload => "批量下载",
            TaskKind::SelectedDownload => "精选下载",
            TaskKind::SingleDownload => "单本下载",
        };
        let ts = Local::now().format("%m-%d %H:%M").to_string();
        if extra.is_empty() { format!("{} {}", prefix, ts) }
        else { format!("{} {}", prefix, extra) }
    }
}

pub type SharedTaskManager = Arc<Mutex<TaskManager>>;
```

**Step 4: Register module in lib.rs**

Add `pub mod task_manager;` after `pub mod history;`

**Step 5: Verify compilation**
```
cd txtx-app/src-tauri
cargo check 2>&1
```
Expected: no errors

**Step 6: Commit**
```
git add txtx-app/src-tauri/src/task_manager/
git add txtx-app/src-tauri/src/lib.rs
git commit -m "feat(backend): add TaskManager module and DB persistence"
```

---

## Task 3: Replace SharedDownloadState with SharedTaskManager in lib.rs (Tauri commands)

**Files:**
- Modify: `txtx-app/src-tauri/src/lib.rs`

This is the largest backend change. Replace the entire `tauri_app` module.

**Step 1: Replace the tauri_app module**

The new module structure in `lib.rs` replaces `struct DownloadState` / `SharedDownloadState` with `SharedTaskManager`. Key changes:

```rust
// At top of tauri_app mod:
use crate::task_manager::{TaskManager, SharedTaskManager};
use crate::models::{TaskId, TaskKind, TaskRecord, TaskStatus, TaskEvent, ScanOptions};
use crate::downloader::ScanOptions as DownloaderScanOptions;

// In pub fn run(), replace:
//   let download_state: SharedDownloadState = ...
// with:
let task_manager: SharedTaskManager = {
    // Load base_dir from config for DB init
    let base_dir = crate::config::load_config()
        .map(|c| std::path::PathBuf::from(&c.paths.base_dir))
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    Arc::new(Mutex::new(TaskManager::new(base_dir)))
};
```

**Step 2: Add helper — spawn_task_worker**

```rust
/// Spawns a tokio task, emits task_event via app.emit, updates task manager on completion.
async fn spawn_task_worker<F, Fut>(
    app: AppHandle,
    tm: SharedTaskManager,
    task_id: TaskId,
    future_factory: F,
) where
    F: FnOnce(mpsc::Sender<ProgressEvent>) -> Fut + Send + 'static,
    Fut: std::future::Future<Output = anyhow::Result<()>> + Send + 'static,
{
    let (tx, mut rx) = mpsc::channel::<ProgressEvent>(512);

    // Event fan-out: wrap each event with task_id and emit
    let app_clone = app.clone();
    let tid = task_id.clone();
    let tm_rx = tm.clone();
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            // Update in-memory counters
            {
                let mut mgr = tm_rx.lock().await;
                match &event {
                    ProgressEvent::NovelDone { .. } => {
                        mgr.update_record(&tid, |r| {
                            r.completed += 1;
                            r.success_count += 1;
                        });
                    }
                    ProgressEvent::NovelError { .. } => {
                        mgr.update_record(&tid, |r| {
                            r.completed += 1;
                            r.error_count += 1;
                        });
                    }
                    ProgressEvent::FilterDone { stats } => {
                        let n = stats.final_download;
                        mgr.update_record(&tid, |r| { r.total = n; r.stats = Some(stats.clone()); });
                    }
                    ProgressEvent::ScanComplete { items, stats } => {
                        mgr.update_record(&tid, |r| {
                            r.scan_items = items.clone();
                            r.scan_stats = Some(stats.clone());
                            r.status = TaskStatus::Preview;
                        });
                    }
                    ProgressEvent::OverallDone => {
                        let base_dir = mgr.base_dir.clone();
                        mgr.update_record(&tid, |r| {
                            r.status = TaskStatus::Done;
                            r.finished_at = Some(chrono::Local::now()
                                .format("%Y-%m-%d %H:%M:%S").to_string());
                        });
                        if let Some(rec) = mgr.get_record(&tid).cloned() {
                            let _ = crate::task_manager::db::save_task(&base_dir, &rec).await;
                        }
                    }
                    _ => {}
                }
            }
            let task_event = TaskEvent { task_id: tid.clone(), event };
            let _ = app_clone.emit("task_event", &task_event);
        }
    });

    // Run worker
    let tm_done = tm.clone();
    let tid2 = task_id.clone();
    tokio::spawn(async move {
        let result = future_factory(tx).await;
        if let Err(e) = result {
            let mut mgr = tm_done.lock().await;
            mgr.update_record(&tid2, |r| {
                r.status = TaskStatus::Failed;
                r.error_message = Some(e.to_string());
                r.finished_at = Some(chrono::Local::now()
                    .format("%Y-%m-%d %H:%M:%S").to_string());
            });
            let base_dir = mgr.base_dir.clone();
            if let Some(rec) = mgr.get_record(&tid2).cloned() {
                let _ = crate::task_manager::db::save_task(&base_dir, &rec).await;
            }
        }
    });
}
```

**Step 3: Add new Tauri commands**

```rust
/// Create and start a new scan task
#[tauri::command]
async fn create_scan_task(
    app: AppHandle,
    tm: State<'_, SharedTaskManager>,
    options: Option<ScanOptions>,
) -> Result<TaskId, String> {
    let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
    let task_id = TaskManager::new_task_id();
    let cancel = Arc::new(Notify::new());

    let label = TaskManager::make_label(&TaskKind::FullScan, "");
    let record = TaskRecord {
        id: task_id.clone(), kind: TaskKind::FullScan,
        status: TaskStatus::Scanning, label,
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        finished_at: None, total: 0, completed: 0,
        success_count: 0, error_count: 0,
        scan_items: vec![], scan_stats: None, stats: None, error_message: None,
    };

    {
        let mut mgr = tm.lock().await;
        mgr.upsert(record, cancel.clone());
    }

    let opts = options.unwrap_or_default();
    let cancel_clone = cancel.clone();
    spawn_task_worker(app, tm.inner().clone(), task_id.clone(), move |tx| async move {
        let so = DownloaderScanOptions {
            target_date: opts.target_date,
            enabled_sites: opts.enabled_sites,
        };
        crate::downloader::run_scan_with_options(cfg, so, tx, cancel_clone).await
    }).await;

    Ok(task_id)
}

/// Start downloading the confirmed selection from a scan task
#[tauri::command]
async fn confirm_task_download(
    app: AppHandle,
    tm: State<'_, SharedTaskManager>,
    task_id: TaskId,
    selected: Vec<crate::models::BookCandidate>,
) -> Result<(), String> {
    let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
    let cancel = Arc::new(Notify::new());

    {
        let mut mgr = tm.lock().await;
        mgr.update_record(&task_id, |r| {
            r.kind = TaskKind::SelectedDownload;
            r.status = TaskStatus::Downloading;
            r.total = selected.len();
            r.cancel = (); // handled separately
        });
        // Replace cancel handle
        if let Some(h) = mgr.handles.get_mut(&task_id) {
            h.cancel = cancel.clone();
        }
    }

    let tid = task_id.clone();
    let cancel_clone = cancel.clone();
    spawn_task_worker(app, tm.inner().clone(), tid, move |tx| async move {
        crate::downloader::run_download_selected(cfg, selected, tx, cancel_clone).await
    }).await;

    Ok(())
}

/// Create a batch download task (scan + auto-download)
#[tauri::command]
async fn create_batch_download_task(
    app: AppHandle,
    tm: State<'_, SharedTaskManager>,
    options: Option<ScanOptions>,
) -> Result<TaskId, String> {
    let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
    let task_id = TaskManager::new_task_id();
    let cancel = Arc::new(Notify::new());

    let label = TaskManager::make_label(&TaskKind::BatchDownload, "");
    let record = TaskRecord {
        id: task_id.clone(), kind: TaskKind::BatchDownload,
        status: TaskStatus::Scanning, label,
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        finished_at: None, total: 0, completed: 0,
        success_count: 0, error_count: 0,
        scan_items: vec![], scan_stats: None, stats: None, error_message: None,
    };

    {
        let mut mgr = tm.lock().await;
        mgr.upsert(record, cancel.clone());
    }

    let opts = options.unwrap_or_default();
    let cancel_clone = cancel.clone();
    spawn_task_worker(app, tm.inner().clone(), task_id.clone(), move |tx| async move {
        // For batch: we override scan options then run full download pipeline
        // Apply site filter to config
        let mut cfg2 = cfg;
        if let Some(ref sites) = opts.enabled_sites {
            if !sites.is_empty() {
                for s in cfg2.websites.values_mut() {
                    if !sites.contains(&s.domain_name) { s.enabled = false; }
                }
            }
        }
        crate::downloader::run_download(cfg2, tx, cancel_clone).await
    }).await;

    Ok(task_id)
}

/// Create a single-URL download task
#[tauri::command]
async fn create_single_download_task(
    app: AppHandle,
    tm: State<'_, SharedTaskManager>,
    url: String,
) -> Result<TaskId, String> {
    let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
    let task_id = TaskManager::new_task_id();
    let cancel = Arc::new(Notify::new());

    // Derive a short label from URL
    let url_label = url.trim_end_matches('/').rsplit('/').next()
        .unwrap_or("单本").to_string();
    let label = TaskManager::make_label(&TaskKind::SingleDownload, &url_label);
    let record = TaskRecord {
        id: task_id.clone(), kind: TaskKind::SingleDownload,
        status: TaskStatus::Downloading, label,
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        finished_at: None, total: 1, completed: 0,
        success_count: 0, error_count: 0,
        scan_items: vec![], scan_stats: None, stats: None, error_message: None,
    };

    {
        let mut mgr = tm.lock().await;
        mgr.upsert(record, cancel.clone());
    }

    let cancel_clone = cancel.clone();
    spawn_task_worker(app, tm.inner().clone(), task_id.clone(), move |tx| async move {
        crate::single_downloader::download_single_novel(cfg, url, tx, cancel_clone).await
    }).await;

    Ok(task_id)
}

/// List all tasks (in-memory, newest first)
#[tauri::command]
async fn list_tasks(tm: State<'_, SharedTaskManager>) -> Result<Vec<TaskRecord>, String> {
    Ok(tm.lock().await.list_records())
}

/// Get one task by id
#[tauri::command]
async fn get_task(tm: State<'_, SharedTaskManager>, task_id: TaskId) -> Result<Option<TaskRecord>, String> {
    Ok(tm.lock().await.get_record(&task_id).cloned())
}

/// Cancel a running task
#[tauri::command]
async fn cancel_task(tm: State<'_, SharedTaskManager>, task_id: TaskId) -> Result<(), String> {
    let mut mgr = tm.lock().await;
    mgr.cancel_task(&task_id);
    mgr.update_record(&task_id, |r| { r.status = TaskStatus::Cancelled; });
    Ok(())
}

/// Pause a downloading task (saves queue, marks Paused)
#[tauri::command]
async fn pause_task(tm: State<'_, SharedTaskManager>, task_id: TaskId) -> Result<(), String> {
    let mgr = tm.lock().await;
    mgr.cancel_task(&task_id);
    drop(mgr);
    let mut mgr = tm.lock().await;
    mgr.update_record(&task_id, |r| { r.status = TaskStatus::Paused; });
    Ok(())
}

/// Delete task record (cancel if running)
#[tauri::command]
async fn delete_task(tm: State<'_, SharedTaskManager>, task_id: TaskId) -> Result<(), String> {
    let mut mgr = tm.lock().await;
    mgr.remove_task(&task_id);
    Ok(())
}

/// Load persisted tasks from DB into memory on startup
#[tauri::command]
async fn load_persisted_tasks(tm: State<'_, SharedTaskManager>) -> Result<Vec<TaskRecord>, String> {
    let base_dir = {
        let mgr = tm.lock().await;
        mgr.base_dir.clone()
    };
    let tasks = crate::task_manager::db::load_all_tasks(&base_dir).await
        .map_err(|e| e.to_string())?;
    {
        let mut mgr = tm.lock().await;
        for t in &tasks {
            let cancel = Arc::new(Notify::new());
            mgr.upsert(t.clone(), cancel);
        }
    }
    Ok(tasks)
}
```

**Step 4: Keep legacy commands for backwards compat** 

Keep `start_scan`, `download_selected`, `start_download`, `stop_download`, `download_single` as thin wrappers that create tasks internally (they just call the new `create_*` commands).

**Step 5: Update invoke_handler in run()**

Replace `manage(download_state)` with `manage(task_manager)` and add all new commands to `invoke_handler![]`.

**Step 6: Verify**
```
cd txtx-app/src-tauri
cargo check 2>&1
```
Expected: no errors (may have warnings about unused imports from old code)

**Step 7: Commit**
```
git add txtx-app/src-tauri/src/lib.rs
git commit -m "feat(backend): replace SharedDownloadState with SharedTaskManager + new commands"
```

---

## Task 4: Frontend — add types and API wrappers

**Files:**
- Modify: `txtx-app/src/types/index.ts`
- Create: `txtx-app/src/lib/api/tasks.ts`
- Modify: `txtx-app/src/lib/api/index.ts`

**Step 1: Add types to `src/types/index.ts`**

Append to end of file:
```typescript
// ─── Task Manager ─────────────────────────────────────────────────────────────

export type TaskId = string;

export type TaskKind =
  | "full_scan"
  | "batch_download"
  | "selected_download"
  | "single_download";

export type TaskStatus =
  | "queued"
  | "scanning"
  | "preview"
  | "downloading"
  | "paused"
  | "done"
  | "failed"
  | "cancelled";

export interface TaskRecord {
  id: TaskId;
  kind: TaskKind;
  status: TaskStatus;
  label: string;
  created_at: string;
  finished_at: string | null;
  total: number;
  completed: number;
  success_count: number;
  error_count: number;
  scan_items: ScanItem[];
  scan_stats: DownloadStats | null;
  stats: DownloadStats | null;
  error_message: string | null;
}

export interface TaskEvent {
  task_id: TaskId;
  type: string;
  // all ProgressEvent fields flattened in
  site?: string;
  novel?: string;
  total?: number;
  current?: number;
  completed?: number;
  stats?: DownloadStats;
  items?: ScanItem[];
  message?: string;
  level?: string;
}

export interface ScanTaskOptions {
  target_date?: string | null;
  enabled_sites?: string[] | null;
}
```

**Step 2: Create `src/lib/api/tasks.ts`**

```typescript
import type { TaskId, TaskRecord, ScanTaskOptions, BookCandidate } from "@/types";
import { IS_TAURI, API_BASE } from "./constants";

export async function apiCreateScanTask(options?: ScanTaskOptions): Promise<TaskId> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<TaskId>("create_scan_task", { options: options ?? null });
  }
  const res = await fetch(`${API_BASE}/api/tasks/scan`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.task_id;
}

export async function apiCreateBatchDownloadTask(options?: ScanTaskOptions): Promise<TaskId> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<TaskId>("create_batch_download_task", { options: options ?? null });
  }
  const res = await fetch(`${API_BASE}/api/tasks/batch`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.task_id;
}

export async function apiCreateSingleDownloadTask(url: string): Promise<TaskId> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<TaskId>("create_single_download_task", { url });
  }
  const res = await fetch(`${API_BASE}/api/tasks/single`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.task_id;
}

export async function apiConfirmTaskDownload(
  taskId: TaskId, selected: BookCandidate[]
): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("confirm_task_download", { taskId, selected });
  }
  await fetch(`${API_BASE}/api/tasks/${taskId}/confirm`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(selected),
  });
}

export async function apiListTasks(): Promise<TaskRecord[]> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<TaskRecord[]>("list_tasks");
  }
  const res = await fetch(`${API_BASE}/api/tasks`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiGetTask(taskId: TaskId): Promise<TaskRecord | null> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<TaskRecord | null>("get_task", { taskId });
  }
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiCancelTask(taskId: TaskId): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("cancel_task", { taskId });
  }
  await fetch(`${API_BASE}/api/tasks/${taskId}/cancel`, { method: "POST" });
}

export async function apiPauseTask(taskId: TaskId): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("pause_task", { taskId });
  }
  await fetch(`${API_BASE}/api/tasks/${taskId}/pause`, { method: "POST" });
}

export async function apiDeleteTask(taskId: TaskId): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("delete_task", { taskId });
  }
  await fetch(`${API_BASE}/api/tasks/${taskId}`, { method: "DELETE" });
}

export async function apiLoadPersistedTasks(): Promise<TaskRecord[]> {
  if (IS_TAURI) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<TaskRecord[]>("load_persisted_tasks");
  }
  return [];
}
```

**Step 3: Export from `src/lib/api/index.ts`**

Add to the existing exports:
```typescript
export * from "./tasks";
```

**Step 4: Commit**
```
git add txtx-app/src/types/index.ts txtx-app/src/lib/api/tasks.ts txtx-app/src/lib/api/index.ts
git commit -m "feat(frontend): add task manager types and API wrappers"
```

---

## Task 5: Frontend — taskStore

**Files:**
- Create: `txtx-app/src/store/taskEventHandler.ts`
- Create: `txtx-app/src/store/taskStore.ts`

**Step 1: Create `src/store/taskEventHandler.ts`**

This fan-out handler updates a single TaskRecord in the store on each `task_event`:

```typescript
import dayjs from "dayjs";
import type { TaskRecord, TaskEvent, LogEntry, ScanItem, DownloadStats } from "@/types";

let logId = 0;
export function makeLogEntry(level: LogEntry["level"], message: string): LogEntry {
  return { id: ++logId, timestamp: dayjs().format("HH:mm:ss"), level, message };
}

/** Returns updated TaskRecord given an incoming TaskEvent. Pure function, no side effects. */
export function applyTaskEvent(record: TaskRecord, event: TaskEvent): TaskRecord {
  const r = { ...record };
  switch (event.type) {
    case "scan_start":
      r.status = "scanning";
      break;
    case "scan_complete":
      r.scan_items = event.items ?? [];
      r.scan_stats = event.stats ?? null;
      r.status = "preview";
      break;
    case "filter_done":
      if (event.stats) {
        r.stats = event.stats;
        r.total = event.stats.final_download;
        r.status = "downloading";
      }
      break;
    case "novel_done":
      r.completed = Math.min(r.completed + 1, r.total);
      r.success_count += 1;
      break;
    case "novel_error":
      r.completed = Math.min(r.completed + 1, r.total);
      r.error_count += 1;
      break;
    case "overall_done":
      r.status = "done";
      r.finished_at = dayjs().format("YYYY-MM-DD HH:mm:ss");
      break;
  }
  return r;
}
```

**Step 2: Create `src/store/taskStore.ts`**

```typescript
import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import type { TaskRecord, TaskId, TaskEvent, LogEntry, BookCandidate, ScanTaskOptions } from "@/types";
import {
  apiCreateScanTask, apiCreateBatchDownloadTask, apiCreateSingleDownloadTask,
  apiConfirmTaskDownload, apiListTasks, apiCancelTask, apiPauseTask,
  apiDeleteTask, apiLoadPersistedTasks,
} from "@/lib/api";
import { applyTaskEvent, makeLogEntry } from "./taskEventHandler";

const MAX_LOGS = 500;

interface PerTaskLogs {
  [taskId: string]: LogEntry[];
}

interface TaskStore {
  tasks: TaskRecord[];
  activeTaskId: TaskId | null;
  logs: PerTaskLogs;
  _initialized: boolean;

  // Lifecycle
  init: () => Promise<void>;

  // Queries
  getTask: (id: TaskId) => TaskRecord | undefined;
  getActiveLogs: () => LogEntry[];

  // Actions
  setActive: (id: TaskId | null) => void;
  createScanTask: (options?: ScanTaskOptions) => Promise<TaskId>;
  createBatchTask: (options?: ScanTaskOptions) => Promise<TaskId>;
  createSingleTask: (url: string) => Promise<TaskId>;
  confirmDownload: (taskId: TaskId, selected: BookCandidate[]) => Promise<void>;
  cancelTask: (id: TaskId) => Promise<void>;
  pauseTask: (id: TaskId) => Promise<void>;
  deleteTask: (id: TaskId) => Promise<void>;
  retryTask: (id: TaskId) => Promise<TaskId | null>;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  activeTaskId: null,
  logs: {},
  _initialized: false,

  init: async () => {
    if (get()._initialized) return;
    set({ _initialized: true });

    // Load persisted tasks
    const persisted = await apiLoadPersistedTasks().catch(() => []);
    const current = await apiListTasks().catch(() => []);
    const merged = [...current];
    for (const p of persisted) {
      if (!merged.find(t => t.id === p.id)) merged.push(p);
    }
    set({ tasks: merged });

    // Subscribe to task_event
    await listen<TaskEvent>("task_event", (e) => {
      const event = e.payload;
      set((s) => {
        // Update task record
        const tasks = s.tasks.map(t =>
          t.id === event.task_id ? applyTaskEvent(t, event) : t
        );

        // Accumulate logs per task
        let newLogs = s.logs;
        if (event.type === "log" && event.message) {
          const entry = makeLogEntry((event.level ?? "info") as LogEntry["level"], event.message);
          const prev = s.logs[event.task_id] ?? [];
          newLogs = {
            ...s.logs,
            [event.task_id]: [...prev.slice(-MAX_LOGS + 1), entry],
          };
        }

        return { tasks, logs: newLogs };
      });
    });
  },

  getTask: (id) => get().tasks.find(t => t.id === id),

  getActiveLogs: () => {
    const { activeTaskId, logs } = get();
    if (!activeTaskId) return [];
    return logs[activeTaskId] ?? [];
  },

  setActive: (id) => set({ activeTaskId: id }),

  createScanTask: async (options) => {
    const id = await apiCreateScanTask(options);
    const newTask: TaskRecord = {
      id, kind: "full_scan", status: "scanning",
      label: `扫描 ${new Date().toLocaleTimeString()}`,
      created_at: new Date().toISOString(), finished_at: null,
      total: 0, completed: 0, success_count: 0, error_count: 0,
      scan_items: [], scan_stats: null, stats: null, error_message: null,
    };
    set((s) => ({ tasks: [newTask, ...s.tasks], activeTaskId: id }));
    return id;
  },

  createBatchTask: async (options) => {
    const id = await apiCreateBatchDownloadTask(options);
    const newTask: TaskRecord = {
      id, kind: "batch_download", status: "scanning",
      label: `批量下载 ${new Date().toLocaleTimeString()}`,
      created_at: new Date().toISOString(), finished_at: null,
      total: 0, completed: 0, success_count: 0, error_count: 0,
      scan_items: [], scan_stats: null, stats: null, error_message: null,
    };
    set((s) => ({ tasks: [newTask, ...s.tasks], activeTaskId: id }));
    return id;
  },

  createSingleTask: async (url) => {
    const id = await apiCreateSingleDownloadTask(url);
    const label = url.trim().split("/").filter(Boolean).pop() ?? url;
    const newTask: TaskRecord = {
      id, kind: "single_download", status: "downloading",
      label: `单本: ${label}`,
      created_at: new Date().toISOString(), finished_at: null,
      total: 1, completed: 0, success_count: 0, error_count: 0,
      scan_items: [], scan_stats: null, stats: null, error_message: null,
    };
    set((s) => ({ tasks: [newTask, ...s.tasks], activeTaskId: id }));
    return id;
  },

  confirmDownload: async (taskId, selected) => {
    await apiConfirmTaskDownload(taskId, selected);
    set((s) => ({
      tasks: s.tasks.map(t => t.id === taskId
        ? { ...t, status: "downloading" as const, total: selected.length }
        : t
      ),
    }));
  },

  cancelTask: async (id) => {
    await apiCancelTask(id);
    set((s) => ({
      tasks: s.tasks.map(t => t.id === id ? { ...t, status: "cancelled" as const } : t),
    }));
  },

  pauseTask: async (id) => {
    await apiPauseTask(id);
    set((s) => ({
      tasks: s.tasks.map(t => t.id === id ? { ...t, status: "paused" as const } : t),
    }));
  },

  deleteTask: async (id) => {
    await apiDeleteTask(id);
    set((s) => ({
      tasks: s.tasks.filter(t => t.id !== id),
      activeTaskId: s.activeTaskId === id ? (s.tasks[0]?.id ?? null) : s.activeTaskId,
    }));
  },

  retryTask: async (id) => {
    const task = get().tasks.find(t => t.id === id);
    if (!task) return null;
    if (task.kind === "single_download") {
      const url = task.scan_items[0]?.url ?? "";
      if (!url) return null;
      return get().createSingleTask(url);
    }
    if (task.kind === "batch_download") return get().createBatchTask();
    if (task.kind === "full_scan") return get().createScanTask();
    return null;
  },
}));
```

**Step 3: Commit**
```
git add txtx-app/src/store/taskEventHandler.ts txtx-app/src/store/taskStore.ts
git commit -m "feat(frontend): add taskStore with event fan-out"
```

---

## Task 6: Frontend — TaskListItem component

**Files:**
- Create: `txtx-app/src/pages/tasks/TaskListItem.tsx`

```tsx
import { Square, Pause, RotateCcw, Trash2, Play } from "lucide-react";
import type { TaskRecord } from "@/types";

interface Props {
  task: TaskRecord;
  isActive: boolean;
  onSelect: () => void;
  onCancel: () => void;
  onPause: () => void;
  onDelete: () => void;
  onRetry: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  scanning:    "var(--color-warning)",
  downloading: "var(--color-accent)",
  preview:     "var(--color-accent)",
  done:        "var(--color-success)",
  failed:      "var(--color-danger)",
  cancelled:   "var(--color-text-muted)",
  paused:      "var(--color-warning)",
  queued:      "var(--color-text-muted)",
};

const STATUS_LABEL: Record<string, string> = {
  scanning:    "扫描中",
  downloading: "下载中",
  preview:     "待确认",
  done:        "完成",
  failed:      "失败",
  cancelled:   "已取消",
  paused:      "已暂停",
  queued:      "排队中",
};

function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const r = 10, c = 2 * Math.PI * r;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
      <circle cx="14" cy="14" r={r} fill="none" stroke="var(--color-border)" strokeWidth="2.5" />
      <circle
        cx="14" cy="14" r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
        strokeLinecap="round" transform="rotate(-90 14 14)"
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
    </svg>
  );
}

export function TaskListItem({ task, isActive, onSelect, onCancel, onPause, onDelete, onRetry }: Props) {
  const color = STATUS_COLOR[task.status] ?? "var(--color-text-muted)";
  const pct = task.total > 0 ? Math.round((task.completed / task.total) * 100) : 0;
  const isRunning = task.status === "scanning" || task.status === "downloading";
  const isDone = task.status === "done" || task.status === "failed" || task.status === "cancelled";

  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer border transition-all"
      style={{
        background: isActive
          ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))"
          : "var(--color-surface)",
        borderColor: isActive ? "var(--color-accent)" : "var(--color-border)",
        borderLeft: isActive ? "2px solid var(--color-accent)" : "2px solid transparent",
      }}
    >
      <ProgressRing pct={pct} color={color} />

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>
          {task.label}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] font-medium" style={{ color }}>
            {STATUS_LABEL[task.status]}
          </span>
          {task.total > 0 && (
            <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
              {task.completed}/{task.total}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
           onClick={(e) => e.stopPropagation()}>
        {isRunning && task.status === "downloading" && (
          <button onClick={onPause}
            className="p-1 rounded hover:bg-[var(--color-surface-2)]"
            title="暂停">
            <Pause className="w-3 h-3" style={{ color: "var(--color-text-muted)" }} />
          </button>
        )}
        {isRunning && (
          <button onClick={onCancel}
            className="p-1 rounded hover:bg-[var(--color-surface-2)]"
            title="取消">
            <Square className="w-3 h-3" style={{ color: "var(--color-danger)" }} />
          </button>
        )}
        {isDone && (
          <button onClick={onRetry}
            className="p-1 rounded hover:bg-[var(--color-surface-2)]"
            title="重试">
            <RotateCcw className="w-3 h-3" style={{ color: "var(--color-accent)" }} />
          </button>
        )}
        {(isDone || task.status === "cancelled" || task.status === "paused") && (
          <button onClick={onDelete}
            className="p-1 rounded hover:bg-[var(--color-surface-2)]"
            title="删除">
            <Trash2 className="w-3 h-3" style={{ color: "var(--color-text-muted)" }} />
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**
```
git add txtx-app/src/pages/tasks/TaskListItem.tsx
git commit -m "feat(frontend): add TaskListItem component"
```

---

## Task 7: Frontend — TaskListPanel

**Files:**
- Create: `txtx-app/src/pages/tasks/TaskListPanel.tsx`

```tsx
import { useState } from "react";
import { Plus, ScanSearch, Download, Link } from "lucide-react";
import { useTaskStore } from "@/store/taskStore";
import { useConfigStore } from "@/store/configStore";
import { TaskListItem } from "./TaskListItem";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ScanOptions } from "@/types";

interface Props {
  onNewScan: (opts: ScanOptions) => void;
  onNewBatch: (opts: ScanOptions) => void;
  onNewSingle: (url: string) => void;
}

export function TaskListPanel({ onNewScan, onNewBatch, onNewSingle }: Props) {
  const { tasks, activeTaskId, setActive, cancelTask, pauseTask, deleteTask, retryTask } = useTaskStore();
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [singleUrl, setSingleUrl] = useState("");

  const running = tasks.filter(t => t.status === "scanning" || t.status === "downloading").length;

  return (
    <div className="flex flex-col h-full border-r" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b shrink-0"
           style={{ borderColor: "var(--color-border)" }}>
        <div>
          <p className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>任务列表</p>
          {running > 0 && (
            <p className="text-[10px]" style={{ color: "var(--color-accent)" }}>{running} 个运行中</p>
          )}
        </div>
        <Button size="sm" onClick={() => setShowNewMenu(v => !v)}>
          <Plus className="w-3.5 h-3.5" /> 新建
        </Button>
      </div>

      {/* New task menu */}
      {showNewMenu && (
        <div className="p-3 border-b flex flex-col gap-2 shrink-0"
             style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}>
          <Button variant="secondary" size="sm" className="justify-start"
            onClick={() => { onNewScan({}); setShowNewMenu(false); }}>
            <ScanSearch className="w-3.5 h-3.5" /> 扫描预览
          </Button>
          <Button variant="secondary" size="sm" className="justify-start"
            onClick={() => { onNewBatch({}); setShowNewMenu(false); }}>
            <Download className="w-3.5 h-3.5" /> 批量下载
          </Button>
          <div className="flex gap-1">
            <Input
              className="flex-1 h-7 text-xs"
              placeholder="输入小说 URL..."
              value={singleUrl}
              onChange={e => setSingleUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && singleUrl.trim()) {
                  onNewSingle(singleUrl.trim());
                  setSingleUrl("");
                  setShowNewMenu(false);
                }
              }}
            />
            <Button size="sm" disabled={!singleUrl.trim()}
              onClick={() => {
                onNewSingle(singleUrl.trim());
                setSingleUrl("");
                setShowNewMenu(false);
              }}>
              <Link className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 p-2">
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>暂无任务</p>
            <p className="text-[10px]" style={{ color: "var(--color-text-subtle)" }}>点击"新建"创建任务</p>
          </div>
        )}
        {tasks.map(task => (
          <div key={task.id} className="group">
            <TaskListItem
              task={task}
              isActive={task.id === activeTaskId}
              onSelect={() => setActive(task.id)}
              onCancel={() => cancelTask(task.id)}
              onPause={() => pauseTask(task.id)}
              onDelete={() => deleteTask(task.id)}
              onRetry={() => retryTask(task.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**
```
git add txtx-app/src/pages/tasks/TaskListPanel.tsx
git commit -m "feat(frontend): add TaskListPanel"
```

---

## Task 8: Frontend — TaskDetailPanel

**Files:**
- Create: `txtx-app/src/pages/tasks/TaskDetailPanel.tsx`

This panel renders different content based on task.status, reusing existing download sub-components as much as possible. It creates a bridge between the new taskStore and existing components that were wired to downloadStore.

```tsx
import { CheckCircle, AlertCircle, Loader2, Zap, FileText, RotateCcw } from "lucide-react";
import { useTaskStore } from "@/store/taskStore";
import { useConfigStore } from "@/store/configStore";
import { AnimatedProgressBar } from "@/components/AnimatedProgressBar";
import { LogPanel } from "@/components/download/LogPanel";
import { ScanPreview } from "@/components/download/ScanPreview";
import { SpeedBar } from "@/components/download/SpeedBar";
import { Button } from "@/components/Button";
import type { TaskRecord } from "@/types";

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <FileText className="w-10 h-10" style={{ color: "var(--color-text-subtle)" }} />
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        选择一个任务查看详情
      </p>
    </div>
  );
}

function TaskStats({ task }: { task: TaskRecord }) {
  if (!task.stats && !task.scan_stats) return null;
  const stats = task.stats ?? task.scan_stats;
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {([
        ["收集", stats.total_collected, "var(--color-text-muted)"],
        ["黑名单", stats.blacklist_filtered, "var(--color-warning)"],
        ["已存在", stats.local_exists, "var(--color-text-muted)"],
        ["待下载", stats.final_download, "var(--color-accent)"],
      ] as [string, number, string][]).map(([label, val, color]) => (
        <div key={label} className="flex flex-col gap-0.5 px-3 py-2 rounded-lg border"
             style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</span>
          <span className="text-lg font-bold tabular-nums" style={{ color }}>{val}</span>
        </div>
      ))}
    </div>
  );
}

function DownloadingView({ task }: { task: TaskRecord }) {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto h-full p-4">
      {task.total > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs" style={{ color: "var(--color-text-muted)" }}>
            <span>总进度</span>
            <span>{task.completed}/{task.total}</span>
          </div>
          <AnimatedProgressBar value={task.completed} total={task.total} />
        </div>
      )}
      <TaskStats task={task} />
      <div className="flex gap-4 mt-2">
        <div className="px-3 py-2 rounded-lg border"
             style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>成功</span>
          <p className="text-lg font-bold" style={{ color: "var(--color-success)" }}>{task.success_count}</p>
        </div>
        <div className="px-3 py-2 rounded-lg border"
             style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>失败</span>
          <p className="text-lg font-bold" style={{ color: "var(--color-danger)" }}>{task.error_count}</p>
        </div>
      </div>
    </div>
  );
}

function DoneView({ task, onRetry }: { task: TaskRecord; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto h-full">
      <div className="flex items-center gap-3">
        <CheckCircle className="w-8 h-8" style={{ color: "var(--color-success)" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>下载完成</p>
          {task.finished_at && (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{task.finished_at}</p>
          )}
        </div>
        {task.error_count > 0 && (
          <Button variant="secondary" size="sm" className="ml-auto" onClick={onRetry}>
            <RotateCcw className="w-3.5 h-3.5" /> 重试失败项
          </Button>
        )}
      </div>
      <div className="flex gap-4">
        <div className="px-3 py-2 rounded-lg border"
             style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>成功</span>
          <p className="text-xl font-bold" style={{ color: "var(--color-success)" }}>{task.success_count}</p>
        </div>
        <div className="px-3 py-2 rounded-lg border"
             style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>失败</span>
          <p className="text-xl font-bold" style={{ color: "var(--color-danger)" }}>{task.error_count}</p>
        </div>
        <div className="px-3 py-2 rounded-lg border"
             style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>合计</span>
          <p className="text-xl font-bold" style={{ color: "var(--color-text)" }}>{task.total}</p>
        </div>
      </div>
      <TaskStats task={task} />
    </div>
  );
}

function FailedView({ task, onRetry }: { task: TaskRecord; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3 p-4 items-center justify-center h-full">
      <AlertCircle className="w-10 h-10" style={{ color: "var(--color-danger)" }} />
      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>任务失败</p>
      {task.error_message && (
        <p className="text-xs text-center max-w-sm px-3 py-2 rounded-lg"
           style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          {task.error_message}
        </p>
      )}
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RotateCcw className="w-3.5 h-3.5" /> 重试
      </Button>
    </div>
  );
}

export function TaskDetailPanel() {
  const { tasks, activeTaskId, getActiveLogs, confirmDownload, retryTask } = useTaskStore();
  const task = tasks.find(t => t.id === activeTaskId);
  const logs = getActiveLogs();

  if (!task) return <EmptyState />;

  // For preview phase, we need to adapt ScanPreview which was written for downloadStore.
  // We create adapter props that feed task.scan_items into the existing component.
  const handleConfirm = (selected: string[]) => {
    const candidates = task.scan_items
      .filter(i => selected.includes(i.url))
      .map(i => ({ name: i.name, url: i.url, crawler_domain: i.site, date: i.date }));
    confirmDownload(task.id, candidates);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Task header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
           style={{ borderColor: "var(--color-border)" }}>
        {(task.status === "scanning" || task.status === "downloading") && (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--color-accent)" }} />
        )}
        {task.status === "done" && (
          <CheckCircle className="w-4 h-4" style={{ color: "var(--color-success)" }} />
        )}
        {task.status === "failed" && (
          <AlertCircle className="w-4 h-4" style={{ color: "var(--color-danger)" }} />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
            {task.label}
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {task.created_at}
          </p>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 min-h-0 gap-0">
        {/* Left: status-specific panel */}
        <div className="w-72 shrink-0 overflow-y-auto border-r"
             style={{ borderColor: "var(--color-border)" }}>
          {task.status === "scanning" && (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--color-accent)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>正在扫描站点...</p>
            </div>
          )}
          {(task.status === "downloading" || task.status === "paused") && (
            <DownloadingView task={task} />
          )}
          {task.status === "done" && (
            <DoneView task={task} onRetry={() => retryTask(task.id)} />
          )}
          {task.status === "failed" && (
            <FailedView task={task} onRetry={() => retryTask(task.id)} />
          )}
        </div>

        {/* Right: preview or logs */}
        <div className="flex-1 flex flex-col min-h-0">
          {task.status === "preview" ? (
            <TaskScanPreviewAdapter task={task} onConfirm={handleConfirm} />
          ) : (
            <TaskLogPanel logs={logs} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Adapter components ───────────────────────────────────────────────────────

/**
 * Wraps the existing ScanPreview with task-store data.
 * ScanPreview reads from downloadStore; here we inject data via a temporary
 * in-memory overlay approach by passing props directly.
 */
function TaskScanPreviewAdapter({
  task, onConfirm,
}: { task: TaskRecord; onConfirm: (selected: string[]) => void }) {
  // We render a local preview table since ScanPreview is tightly coupled to downloadStore.
  // A future refactor can extract ScanPreview to accept props.
  const [selected, setSelected] = useState<Set<string>>(
    new Set(task.scan_items.filter(i => !i.excluded_reason).map(i => i.url))
  );

  const eligible = task.scan_items.filter(i => !i.excluded_reason);
  const excluded = task.scan_items.filter(i => i.excluded_reason);

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3">
      <div className="flex items-center justify-between shrink-0">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          扫描结果 — {eligible.length} 本可下载
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"
            onClick={() => setSelected(new Set())}>全不选</Button>
          <Button variant="secondary" size="sm"
            onClick={() => setSelected(new Set(eligible.map(i => i.url)))}>全选</Button>
          <Button size="sm" disabled={selected.size === 0}
            onClick={() => onConfirm(Array.from(selected))}>
            下载选中 ({selected.size})
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-1">
        {task.scan_items.map(item => (
          <div key={item.url}
               className="flex items-center gap-2 px-3 py-2 rounded-lg border"
               style={{
                 background: "var(--color-surface)",
                 borderColor: "var(--color-border)",
                 opacity: item.excluded_reason ? 0.5 : 1,
               }}>
            {!item.excluded_reason && (
              <input
                type="checkbox"
                checked={selected.has(item.url)}
                onChange={() => {
                  const n = new Set(selected);
                  if (n.has(item.url)) n.delete(item.url); else n.add(item.url);
                  setSelected(n);
                }}
                className="shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>
                {item.name}
              </p>
              <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                {item.site} · {item.date}
                {item.excluded_reason && ` · ${item.excluded_reason}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// Note: add "import { useState } from 'react';" at top of file

function TaskLogPanel({ logs }: { logs: import("@/types").LogEntry[] }) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] flex flex-col gap-0.5">
        {logs.length === 0 && (
          <p className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
            等待日志...
          </p>
        )}
        {logs.map(log => (
          <div key={log.id} className="flex gap-2">
            <span className="shrink-0" style={{ color: "var(--color-text-subtle)" }}>
              {log.timestamp}
            </span>
            <span style={{
              color: log.level === "error" ? "var(--color-danger)"
                   : log.level === "warn" ? "var(--color-warning)"
                   : log.level === "success" ? "var(--color-success)"
                   : "var(--color-text-muted)",
            }}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**
```
git add txtx-app/src/pages/tasks/TaskDetailPanel.tsx
git commit -m "feat(frontend): add TaskDetailPanel with status-adaptive views"
```

---

## Task 9: Frontend — TaskManagerPage and wiring

**Files:**
- Create: `txtx-app/src/pages/tasks/TaskManagerPage.tsx`
- Modify: `txtx-app/src/App.tsx`
- Modify: `txtx-app/src/components/Sidebar.tsx`

**Step 1: Create TaskManagerPage**

```tsx
import { useEffect } from "react";
import { useTaskStore } from "@/store/taskStore";
import { useConfigStore } from "@/store/configStore";
import { TaskListPanel } from "./TaskListPanel";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { PageHeader } from "@/components/PageHeader";

export function TaskManagerPage() {
  const { init, tasks, createScanTask, createBatchTask, createSingleTask } = useTaskStore();
  const { config } = useConfigStore();

  useEffect(() => { init(); }, [init]);

  const running = tasks.filter(
    t => t.status === "scanning" || t.status === "downloading"
  ).length;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: task list — fixed width */}
      <div className="w-64 shrink-0 overflow-hidden flex flex-col">
        <TaskListPanel
          onNewScan={(opts) => createScanTask(opts)}
          onNewBatch={(opts) => createBatchTask(opts)}
          onNewSingle={(url) => createSingleTask(url)}
        />
      </div>

      {/* Right: detail */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <TaskDetailPanel />
      </div>
    </div>
  );
}
```

**Step 2: Add route in App.tsx**

```tsx
import { TaskManagerPage } from "@/pages/tasks/TaskManagerPage";
// Add inside <Routes>:
<Route path="/tasks" element={<TaskManagerPage />} />
```

**Step 3: Add sidebar item in Sidebar.tsx**

```tsx
import { ListTodo } from "lucide-react";
// Add to navItems array (before history):
{ to: "/tasks", icon: ListTodo, label: "任务管理" },
```

**Step 4: Build and verify**
```
cd txtx-app
pnpm run build 2>&1 | tail -30
```
Expected: build succeeds, no TypeScript errors

**Step 5: Commit**
```
git add txtx-app/src/pages/tasks/ txtx-app/src/App.tsx txtx-app/src/components/Sidebar.tsx
git commit -m "feat(frontend): add TaskManagerPage with list+detail layout"
```

---

## Task 10: Full backend compilation and integration test

**Files:** No new files — this is a validation task

**Step 1: Full cargo build**
```
cd txtx-app/src-tauri
cargo build 2>&1
```
Expected: compiles successfully. Fix any borrow checker or type errors.

**Step 2: Fix common issues**

- If `TaskRecord.cancel` field causes issues: `cancel` is NOT a field on TaskRecord (it lives in TaskHandle). Verify the struct definition.
- If `confirm_task_download` has borrow issue with `h.cancel`: use `h.record.status = TaskStatus::Downloading;` without trying to access a cancel field on record.
- If spawn_task_worker requires `'static` but captures `&State`: use `.inner().clone()` to get `Arc` out.

**Step 3: Dev run (Tauri)**
```
cd txtx-app
pnpm tauri dev
```
Verify:
1. App loads without errors
2. `/tasks` route shows TaskManagerPage
3. Click "新建" → "扫描预览" → creates a task entry in the left list
4. Task shows "扫描中" status with spinning indicator
5. After scan completes, status changes to "待确认" and scan results appear
6. Click "下载选中" → status changes to "下载中"
7. Progress updates live via task_event events
8. On completion, status shows "完成" with success/error counts

**Step 4: Commit final integration**
```
git add -A
git commit -m "feat: complete task manager - multi-task download management system"
```

---

## Task 11: Cleanup and polish

**Files:**
- Optionally keep `/download` route pointing to legacy DownloadPage
- Or replace DownloadPage with redirect to /tasks

**Step 1: Update Sidebar default route**

Change the Download nav item to point to `/tasks`:
```tsx
{ to: "/tasks", icon: ListTodo, label: "任务管理" },
```
Remove old Download entry, or keep it pointing to the legacy single-task UI.

**Step 2: Update App default route**

```tsx
<Route path="/" element={<TaskManagerPage />} />
```

**Step 3: Final build verification**
```
cd txtx-app
pnpm run build
```

**Step 4: Commit**
```
git add txtx-app/src/App.tsx txtx-app/src/components/Sidebar.tsx
git commit -m "feat: make TaskManagerPage the default download page"
```

---

## Summary

| Layer | Change |
|-------|--------|
| Rust types | `TaskId`, `TaskKind`, `TaskStatus`, `TaskRecord`, `TaskEvent` added to `models/runtime.rs` |
| Rust task_manager | New module: `TaskManager` (in-memory), `db.rs` (SQLite persistence) |
| Rust lib.rs | Replace `SharedDownloadState` → `SharedTaskManager`; 9 new commands; `spawn_task_worker` helper |
| TS types | `TaskRecord`, `TaskEvent`, `ScanTaskOptions` added |
| TS api/tasks.ts | 8 API wrappers (create/list/get/cancel/pause/delete/confirm/load) |
| TS taskStore | Zustand store with event fan-out, per-task log accumulation |
| TS taskEventHandler | Pure `applyTaskEvent` function |
| UI TaskListItem | Progress ring + status badge + inline action buttons |
| UI TaskListPanel | Left sidebar: task list + new task menu |
| UI TaskDetailPanel | Right panel: adaptive to scanning/preview/downloading/done/failed |
| UI TaskManagerPage | Layout wrapper, wires left+right panels |
| App.tsx + Sidebar | New `/tasks` route + nav entry |

use crate::models::{DownloadStats, ScanItem, TaskKind, TaskRecord, TaskStatus};
use anyhow::Result;
use rusqlite::{params, Connection};
/// Persist task sessions to SQLite (same DB as history: download_history.db)
use std::path::Path;

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
            source_url      TEXT,
            retry_context_json TEXT,
            preview_draft_json TEXT,
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
        );",
    )?;
    let _ = conn.execute(
        "ALTER TABLE task_sessions ADD COLUMN retry_context_json TEXT",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE task_sessions ADD COLUMN preview_draft_json TEXT",
        [],
    );
    Ok(())
}

pub async fn save_task(base_dir: &Path, task: &TaskRecord) -> Result<()> {
    let base_dir = base_dir.to_path_buf();
    let task = task.clone();
    tokio::task::spawn_blocking(move || {
        let conn = open_db(&base_dir)?;
        let stats_json = task.stats.as_ref()
            .and_then(|s| serde_json::to_string(s).ok());
        let retry_context_json = task.retry_context.as_ref()
            .and_then(|ctx| serde_json::to_string(ctx).ok());
        let preview_draft_json = task.preview_draft.as_ref()
            .and_then(|draft| serde_json::to_string(draft).ok());
        let scan_items_json = if task.scan_items.is_empty() {
            None
        } else {
            serde_json::to_string(&task.scan_items).ok()
        };
        let scan_stats_json = task.scan_stats.as_ref()
            .and_then(|s| serde_json::to_string(s).ok());
        // serde_json serializes enum variants as quoted strings like "full_scan"
        let kind_json = serde_json::to_string(&task.kind)?;
        let kind = kind_json.trim_matches('"').to_string();
        let status_json = serde_json::to_string(&task.status)?;
        let status = status_json.trim_matches('"').to_string();
        conn.execute(
            "INSERT OR REPLACE INTO task_sessions
             (id,kind,status,label,created_at,finished_at,total,completed,
              source_url,retry_context_json,preview_draft_json,success_count,error_count,stats_json,scan_items_json,scan_stats_json,error_message)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)",
            params![
                task.id, kind, status, task.label,
                task.created_at, task.finished_at,
                task.total as i64, task.completed as i64,
                task.source_url,
                retry_context_json,
                preview_draft_json,
                task.success_count as i64, task.error_count as i64,
                stats_json, scan_items_json, scan_stats_json,
                task.error_message
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
        // Check if table exists (might not exist on fresh install)
        let table_exists: bool = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='task_sessions'",
            [],
            |r| r.get::<_, i64>(0),
        ).unwrap_or(0) > 0;
        if !table_exists { return Ok(vec![]); }

        let mut stmt = conn.prepare(
            "SELECT id,kind,status,label,source_url,retry_context_json,preview_draft_json,created_at,finished_at,total,completed,
                    success_count,error_count,stats_json,scan_items_json,scan_stats_json,error_message
             FROM task_sessions ORDER BY created_at DESC LIMIT 100"
        )?;
        let tasks: Vec<TaskRecord> = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,   // id
                row.get::<_, String>(1)?,   // kind
                row.get::<_, String>(2)?,   // status
                row.get::<_, String>(3)?,   // label
                row.get::<_, Option<String>>(4)?,  // source_url
                row.get::<_, Option<String>>(5)?,  // retry_context_json
                row.get::<_, Option<String>>(6)?,  // preview_draft_json
                row.get::<_, String>(7)?,   // created_at
                row.get::<_, Option<String>>(8)?,  // finished_at
                row.get::<_, i64>(9)? as usize,    // total
                row.get::<_, i64>(10)? as usize,    // completed
                row.get::<_, i64>(11)? as usize,   // success_count
                row.get::<_, i64>(12)? as usize,   // error_count
                row.get::<_, Option<String>>(13)?, // stats_json
                row.get::<_, Option<String>>(14)?, // scan_items_json
                row.get::<_, Option<String>>(15)?, // scan_stats_json
                row.get::<_, Option<String>>(16)?, // error_message
            ))
        })?.filter_map(|r| r.ok()).map(|t| {
            let kind: TaskKind = serde_json::from_str(&format!("\"{}\"", t.1))
                .unwrap_or(TaskKind::BatchDownload);
            let status: TaskStatus = serde_json::from_str(&format!("\"{}\"", t.2))
                .unwrap_or(TaskStatus::Done);
            let retry_context = t.5.as_ref()
                .and_then(|s| serde_json::from_str(s).ok());
            let preview_draft = t.6.as_ref()
                .and_then(|s| serde_json::from_str(s).ok());
            let stats: Option<DownloadStats> = t.13.as_ref()
                .and_then(|s| serde_json::from_str(s).ok());
            let scan_items: Vec<ScanItem> = t.14.as_ref()
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or_default();
            let scan_stats: Option<DownloadStats> = t.15.as_ref()
                .and_then(|s| serde_json::from_str(s).ok());
            TaskRecord {
                id: t.0, kind, status,
                label: t.3, source_url: t.4, retry_context, preview_draft, created_at: t.7, finished_at: t.8,
                total: t.9, completed: t.10,
                success_count: t.11, error_count: t.12,
                stats, scan_items, scan_stats,
                error_message: t.16,
            }
        }).collect();
        Ok(tasks)
    }).await?
}

pub async fn delete_task(base_dir: &Path, task_id: &str) -> Result<()> {
    let base_dir = base_dir.to_path_buf();
    let task_id = task_id.to_string();
    tokio::task::spawn_blocking(move || {
        let conn = open_db(&base_dir)?;
        conn.execute("DELETE FROM task_sessions WHERE id = ?1", params![task_id])?;
        Ok::<_, anyhow::Error>(())
    })
    .await??;
    Ok(())
}

/// Persist task sessions to SQLite (same DB as history: download_history.db)
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
            source_url      TEXT,
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

pub async fn save_task(base_dir: &Path, task: &TaskRecord) -> Result<()> {
    let base_dir = base_dir.to_path_buf();
    let task = task.clone();
    tokio::task::spawn_blocking(move || {
        let conn = open_db(&base_dir)?;
        let stats_json = task.stats.as_ref()
            .and_then(|s| serde_json::to_string(s).ok());
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
              source_url,success_count,error_count,stats_json,scan_items_json,scan_stats_json,error_message)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
            params![
                task.id, kind, status, task.label,
                task.created_at, task.finished_at,
                task.total as i64, task.completed as i64,
                task.source_url,
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
            "SELECT id,kind,status,label,source_url,created_at,finished_at,total,completed,
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
                row.get::<_, String>(5)?,   // created_at
                row.get::<_, Option<String>>(6)?,  // finished_at
                row.get::<_, i64>(7)? as usize,    // total
                row.get::<_, i64>(8)? as usize,    // completed
                row.get::<_, i64>(9)? as usize,    // success_count
                row.get::<_, i64>(10)? as usize,   // error_count
                row.get::<_, Option<String>>(11)?, // stats_json
                row.get::<_, Option<String>>(12)?, // scan_items_json
                row.get::<_, Option<String>>(13)?, // scan_stats_json
                row.get::<_, Option<String>>(14)?, // error_message
            ))
        })?.filter_map(|r| r.ok()).map(|t| {
            let kind: TaskKind = serde_json::from_str(&format!("\"{}\"", t.1))
                .unwrap_or(TaskKind::BatchDownload);
            let status: TaskStatus = serde_json::from_str(&format!("\"{}\"", t.2))
                .unwrap_or(TaskStatus::Done);
            let stats: Option<DownloadStats> = t.11.as_ref()
                .and_then(|s| serde_json::from_str(s).ok());
            let scan_items: Vec<ScanItem> = t.12.as_ref()
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or_default();
            let scan_stats: Option<DownloadStats> = t.13.as_ref()
                .and_then(|s| serde_json::from_str(s).ok());
            TaskRecord {
                id: t.0, kind, status,
                label: t.3, source_url: t.4, created_at: t.5, finished_at: t.6,
                total: t.7, completed: t.8,
                success_count: t.9, error_count: t.10,
                stats, scan_items, scan_stats,
                error_message: t.14,
            }
        }).collect();
        Ok(tasks)
    }).await?
}

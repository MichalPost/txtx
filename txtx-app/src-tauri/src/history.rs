/// Download history — persisted in SQLite (download_history.db)
/// Backward-compatible: on first use, migrates existing download_history.json.

use std::path::{Path, PathBuf};
use anyhow::Result;
use chrono::Local;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub name: String,
    pub url: String,
    pub site: String,
    pub downloaded_at: String,
    pub status: String, // "success" | "error"
    pub message: Option<String>,
}

/// Query parameters for paginated / filtered history
#[derive(Debug, Clone, Deserialize, Default)]
pub struct HistoryQuery {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub search: Option<String>,
    pub status: Option<String>, // "success" | "error" | None = all
    pub site: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryPage {
    pub entries: Vec<HistoryEntry>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

/// Daily download count for chart
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyStat {
    pub date: String,
    pub success: i64,
    pub error: i64,
}

/// Site distribution for chart
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteStat {
    pub site: String,
    pub count: i64,
}

fn db_path(base_dir: &Path) -> PathBuf {
    base_dir.join("download_history.db")
}

fn open_db(base_dir: &Path) -> Result<Connection> {
    let path = db_path(base_dir);
    let conn = Connection::open(&path)?;
    // WAL mode for concurrent read/write
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS history (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT NOT NULL,
            url           TEXT NOT NULL DEFAULT '',
            site          TEXT NOT NULL DEFAULT '',
            downloaded_at TEXT NOT NULL,
            status        TEXT NOT NULL DEFAULT 'success',
            message       TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_history_downloaded_at ON history(downloaded_at DESC);
        CREATE INDEX IF NOT EXISTS idx_history_site ON history(site);
        CREATE INDEX IF NOT EXISTS idx_history_status ON history(status);
        CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(
            name, url, site,
            content='history',
            content_rowid='id'
        );
        CREATE TRIGGER IF NOT EXISTS history_ai AFTER INSERT ON history BEGIN
            INSERT INTO history_fts(rowid, name, url, site)
            VALUES (new.id, new.name, new.url, new.site);
        END;
        CREATE TRIGGER IF NOT EXISTS history_ad AFTER DELETE ON history BEGIN
            INSERT INTO history_fts(history_fts, rowid, name, url, site)
            VALUES ('delete', old.id, old.name, old.url, old.site);
        END;",
    )?;
    Ok(())
}

/// Migrate legacy JSON history file to SQLite (one-time)
async fn maybe_migrate_json(base_dir: &Path) -> Result<()> {
    let json_path = base_dir.join("download_history.json");
    if !json_path.exists() { return Ok(()); }
    let db = db_path(base_dir);
    // If DB already has entries, skip
    if db.exists() {
        let conn = Connection::open(&db)?;
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM history", [], |r| r.get(0)).unwrap_or(0);
        if count > 0 { return Ok(()); }
    }
    // Read JSON
    let data = tokio::fs::read_to_string(&json_path).await?;
    #[derive(Deserialize, Default)]
    struct Hf { entries: Vec<HistoryEntry> }
    let hf: Hf = serde_json::from_str(&data).unwrap_or_default();
    if hf.entries.is_empty() { return Ok(()); }

    let conn = open_db(base_dir)?;
    let mut stmt = conn.prepare(
        "INSERT INTO history (name, url, site, downloaded_at, status, message) VALUES (?1,?2,?3,?4,?5,?6)"
    )?;
    for e in &hf.entries {
        stmt.execute(params![e.name, e.url, e.site, e.downloaded_at, e.status, e.message])?;
    }
    tracing::info!("Migrated {} history entries from JSON to SQLite", hf.entries.len());
    // Rename old file
    let _ = tokio::fs::rename(&json_path, base_dir.join("download_history.json.bak")).await;
    Ok(())
}

pub async fn load_history(base_dir: &Path) -> Result<Vec<HistoryEntry>> {
    maybe_migrate_json(base_dir).await.ok();
    let base_dir = base_dir.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let conn = open_db(&base_dir)?;
        let mut stmt = conn.prepare(
            "SELECT name, url, site, downloaded_at, status, message
             FROM history ORDER BY downloaded_at DESC LIMIT 2000"
        )?;
        let entries = stmt.query_map([], |row| Ok(HistoryEntry {
            name: row.get(0)?,
            url: row.get(1)?,
            site: row.get(2)?,
            downloaded_at: row.get(3)?,
            status: row.get(4)?,
            message: row.get(5)?,
        }))?.filter_map(|r| r.ok()).collect();
        Ok(entries)
    }).await?
}

pub async fn query_history(base_dir: &Path, query: HistoryQuery) -> Result<HistoryPage> {
    maybe_migrate_json(base_dir).await.ok();
    let base_dir = base_dir.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let conn = open_db(&base_dir)?;
        let page = query.page.unwrap_or(1).max(1);
        let page_size = query.page_size.unwrap_or(50).clamp(1, 200);
        let offset = (page - 1) * page_size;

        // Build dynamic WHERE
        let mut conditions: Vec<String> = Vec::new();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref search) = query.search {
            if !search.trim().is_empty() {
                conditions.push("id IN (SELECT rowid FROM history_fts WHERE history_fts MATCH ?1)".to_string());
                params_vec.push(Box::new(format!("{}*", search.trim())));
            }
        }
        if let Some(ref status) = query.status {
            if status == "success" || status == "error" {
                conditions.push(format!("status = '{}'", status));
            }
        }
        if let Some(ref site) = query.site {
            if !site.is_empty() {
                conditions.push("site LIKE ?".to_string());
                params_vec.push(Box::new(format!("%{}%", site)));
            }
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        // Count
        let count_sql = format!("SELECT COUNT(*) FROM history {}", where_clause);
        let total: i64 = if params_vec.is_empty() {
            conn.query_row(&count_sql, [], |r| r.get(0))?
        } else {
            let refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
            conn.query_row(&count_sql, refs.as_slice(), |r| r.get(0))?
        };

        // Fetch page
        let data_sql = format!(
            "SELECT name, url, site, downloaded_at, status, message
             FROM history {} ORDER BY downloaded_at DESC LIMIT {} OFFSET {}",
            where_clause, page_size, offset
        );

        // rusqlite borrow rules: stmt must outlive the iterator.
        // We eagerly collect inside the same scope to satisfy the borrow checker.
        let entries: Vec<HistoryEntry> = {
            let mut stmt = conn.prepare(&data_sql)?;
            let row_mapper = |row: &rusqlite::Row<'_>| {
                Ok(HistoryEntry {
                    name: row.get(0)?, url: row.get(1)?, site: row.get(2)?,
                    downloaded_at: row.get(3)?, status: row.get(4)?, message: row.get(5)?,
                })
            };
            if params_vec.is_empty() {
                stmt.query_map([], row_mapper)?
                    .filter_map(|r| r.ok())
                    .collect()
            } else {
                let refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
                stmt.query_map(refs.as_slice(), row_mapper)?
                    .filter_map(|r| r.ok())
                    .collect()
            }
        };

        Ok(HistoryPage { entries, total, page, page_size })
    }).await?
}

pub async fn get_daily_stats(base_dir: &Path, days: i64) -> Result<Vec<DailyStat>> {
    let base_dir = base_dir.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let conn = open_db(&base_dir)?;
        let mut stmt = conn.prepare(
            "SELECT substr(downloaded_at, 1, 10) as day,
                    SUM(CASE WHEN status='success' THEN 1 ELSE 0 END),
                    SUM(CASE WHEN status='error' THEN 1 ELSE 0 END)
             FROM history
             WHERE downloaded_at >= date('now', ?1)
             GROUP BY day ORDER BY day ASC"
        )?;
        let stats = stmt.query_map(params![format!("-{} days", days)], |row| {
            Ok(DailyStat {
                date: row.get(0)?,
                success: row.get(1)?,
                error: row.get(2)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        Ok(stats)
    }).await?
}

pub async fn get_site_stats(base_dir: &Path) -> Result<Vec<SiteStat>> {
    let base_dir = base_dir.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let conn = open_db(&base_dir)?;
        let mut stmt = conn.prepare(
            "SELECT site, COUNT(*) as cnt FROM history
             WHERE status='success' GROUP BY site ORDER BY cnt DESC LIMIT 20"
        )?;
        let stats = stmt.query_map([], |row| {
            Ok(SiteStat { site: row.get(0)?, count: row.get(1)? })
        })?.filter_map(|r| r.ok()).collect();
        Ok(stats)
    }).await?
}

pub async fn append_entry(base_dir: &Path, entry: HistoryEntry) -> Result<()> {
    let base_dir = base_dir.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let conn = open_db(&base_dir)?;
        conn.execute(
            "INSERT INTO history (name, url, site, downloaded_at, status, message)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![entry.name, entry.url, entry.site, entry.downloaded_at, entry.status, entry.message],
        )?;
        Ok(())
    }).await?
}

pub async fn clear_history(base_dir: &Path) -> Result<()> {
    let base_dir = base_dir.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let conn = open_db(&base_dir)?;
        conn.execute_batch(
            "DELETE FROM history;
             INSERT INTO history_fts(history_fts) VALUES ('rebuild');"
        )?;
        Ok(())
    }).await?
}

pub fn make_entry(
    name: &str, url: &str, site: &str,
    status: &str, message: Option<String>,
) -> HistoryEntry {
    HistoryEntry {
        name: name.to_string(),
        url: url.to_string(),
        site: site.to_string(),
        downloaded_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        status: status.to_string(),
        message,
    }
}

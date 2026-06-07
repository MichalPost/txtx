use std::path::{Path, PathBuf};
use anyhow::Result;
use rusqlite::{Connection, params};
use serde::Deserialize;

use super::HistoryEntry;

pub(super) fn db_path(base_dir: &Path) -> PathBuf {
    base_dir.join("download_history.db")
}

pub(super) fn open_db(base_dir: &Path) -> Result<Connection> {
    let path = db_path(base_dir);
    let conn = Connection::open(&path)?;
    // WAL mode for concurrent read/write
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
    migrate(&conn)?;
    Ok(conn)
}

pub(super) fn migrate(conn: &Connection) -> Result<()> {
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
pub(super) async fn maybe_migrate_json(base_dir: &Path) -> Result<()> {
    let json_path = base_dir.join("download_history.json");
    if !json_path.exists() { return Ok(()); }

    // Read JSON first (async, no DB connection held across await)
    let data = tokio::fs::read_to_string(&json_path).await?;
    #[derive(Deserialize, Default)]
    struct Hf { entries: Vec<HistoryEntry> }
    let hf: Hf = serde_json::from_str(&data).unwrap_or_default();
    if hf.entries.is_empty() { return Ok(()); }

    // All SQLite work in spawn_blocking — rusqlite::Connection is not Send
    let base_dir_owned = base_dir.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let db = db_path(&base_dir_owned);
        if db.exists() {
            let conn = Connection::open(&db)?;
            let count: i64 = conn.query_row("SELECT COUNT(*) FROM history", [], |r| r.get(0)).unwrap_or(0);
            if count > 0 { return Ok(()); }
        }
        let conn = open_db(&base_dir_owned)?;
        let mut stmt = conn.prepare(
            "INSERT INTO history (name, url, site, downloaded_at, status, message) VALUES (?1,?2,?3,?4,?5,?6)"
        )?;
        for e in &hf.entries {
            stmt.execute(params![e.name, e.url, e.site, e.downloaded_at, e.status, e.message])?;
        }
        tracing::info!("Migrated {} history entries from JSON to SQLite", hf.entries.len());
        Ok::<_, anyhow::Error>(())
    }).await??;

    // Rename old file after migration
    let _ = tokio::fs::rename(&json_path, json_path.with_extension("json.bak")).await;
    Ok(())
}

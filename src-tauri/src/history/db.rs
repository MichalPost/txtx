use anyhow::Result;
use rusqlite::Connection;
use std::path::{Path, PathBuf};

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

/// AI config persistence — stored in the shared download_history.db.
/// There is always exactly one row (id = 1); upsert on every save.
use std::path::Path;
use anyhow::Result;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfigRecord {
    pub enabled: bool,
    pub provider: String,
    pub base_url: String,
    /// Stored as plaintext in local SQLite — same security boundary as the
    /// config.yml file on disk. Not transmitted to any remote service.
    pub api_key: String,
    pub model: String,
    pub max_tokens: i64,
    pub temperature: f64,
}

impl Default for AiConfigRecord {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: "deepseek".to_string(),
            base_url: "https://api.deepseek.com/v1".to_string(),
            api_key: String::new(),
            model: "deepseek-chat".to_string(),
            max_tokens: 2048,
            temperature: 0.2,
        }
    }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

fn open_db(base_dir: &Path) -> Result<Connection> {
    let path = base_dir.join("download_history.db");
    let conn = Connection::open(&path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS ai_config (
            id          INTEGER PRIMARY KEY,
            enabled     INTEGER NOT NULL DEFAULT 0,
            provider    TEXT    NOT NULL DEFAULT 'deepseek',
            base_url    TEXT    NOT NULL DEFAULT '',
            api_key     TEXT    NOT NULL DEFAULT '',
            model       TEXT    NOT NULL DEFAULT '',
            max_tokens  INTEGER NOT NULL DEFAULT 2048,
            temperature REAL    NOT NULL DEFAULT 0.2
        );",
    )?;
    Ok(())
}

// ─── Public API ───────────────────────────────────────────────────────────────

/// Load AI config from DB. Returns Default if no row exists yet.
pub async fn load(base_dir: &Path) -> Result<AiConfigRecord> {
    let base_dir = base_dir.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let conn = open_db(&base_dir)?;
        let result = conn.query_row(
            "SELECT enabled, provider, base_url, api_key, model, max_tokens, temperature
             FROM ai_config WHERE id = 1",
            [],
            |row| {
                Ok(AiConfigRecord {
                    enabled:     row.get::<_, i64>(0)? != 0,
                    provider:    row.get(1)?,
                    base_url:    row.get(2)?,
                    api_key:     row.get(3)?,
                    model:       row.get(4)?,
                    max_tokens:  row.get(5)?,
                    temperature: row.get(6)?,
                })
            },
        );
        match result {
            Ok(rec) => Ok(rec),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(AiConfigRecord::default()),
            Err(e) => Err(anyhow::anyhow!(e)),
        }
    })
    .await?
}

/// Save (upsert) AI config. Always writes to id = 1.
pub async fn save(base_dir: &Path, cfg: &AiConfigRecord) -> Result<()> {
    let base_dir = base_dir.to_path_buf();
    let cfg = cfg.clone();
    tokio::task::spawn_blocking(move || {
        let conn = open_db(&base_dir)?;
        conn.execute(
            "INSERT INTO ai_config
                (id, enabled, provider, base_url, api_key, model, max_tokens, temperature)
             VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
                enabled     = excluded.enabled,
                provider    = excluded.provider,
                base_url    = excluded.base_url,
                api_key     = excluded.api_key,
                model       = excluded.model,
                max_tokens  = excluded.max_tokens,
                temperature = excluded.temperature",
            params![
                cfg.enabled as i64,
                cfg.provider,
                cfg.base_url,
                cfg.api_key,
                cfg.model,
                cfg.max_tokens,
                cfg.temperature,
            ],
        )?;
        Ok(())
    })
    .await?
}

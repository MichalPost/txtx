/// AI config persistence — stored in {appDataDir}/txtx/app.db.
///
/// Schema (v2 — multi-provider):
///   ai_meta      (key TEXT PK, value TEXT)   — stores enabled flag + active_provider
///   ai_providers (name TEXT PK, ...)          — one row per provider
///
use std::path::Path;
use anyhow::Result;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

// ─── Public types (mirror the TypeScript AiMultiConfig / AiProviderEntry) ─────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProviderEntry {
    pub name: String,
    pub base_url: String,
    /// Stored as plaintext in local SQLite — same security boundary as any
    /// local config file. Not transmitted to any remote service by this code.
    pub api_key: String,
    pub model: String,
    pub available_models: Vec<String>,
    pub max_tokens: i64,
    pub temperature: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiMultiConfig {
    pub enabled: bool,
    pub active_provider: String,
    pub providers: Vec<AiProviderEntry>,
}

impl Default for AiMultiConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            active_provider: "deepseek".to_string(),
            providers: vec![AiProviderEntry {
                name: "deepseek".to_string(),
                base_url: "https://api.deepseek.com/v1".to_string(),
                api_key: String::new(),
                model: "deepseek-chat".to_string(),
                available_models: vec![
                    "deepseek-chat".to_string(),
                    "deepseek-reasoner".to_string(),
                ],
                max_tokens: 2048,
                temperature: 0.2,
            }],
        }
    }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

fn open_db(app_data_dir: &Path) -> Result<Connection> {
    let path = app_data_dir.join("txtx").join("app.db");
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(&path)?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;",
    )?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> Result<()> {
    // ── v2 tables ─────────────────────────────────────────────────────────────
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS ai_meta (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ai_providers (
            name              TEXT    PRIMARY KEY,
            base_url          TEXT    NOT NULL DEFAULT '',
            api_key           TEXT    NOT NULL DEFAULT '',
            model             TEXT    NOT NULL DEFAULT '',
            available_models  TEXT    NOT NULL DEFAULT '[]',
            max_tokens        INTEGER NOT NULL DEFAULT 2048,
            temperature       REAL    NOT NULL DEFAULT 0.2,
            sort_order        INTEGER NOT NULL DEFAULT 0
        );
        ",
    )?;

    Ok(())
}

// ─── Public API ───────────────────────────────────────────────────────────────

/// Load the full multi-provider AI config from DB.
/// Returns `AiMultiConfig::default()` if the DB has no data yet.
pub async fn load(app_data_dir: &Path) -> Result<AiMultiConfig> {
    let app_data_dir = app_data_dir.to_path_buf();
    tokio::task::spawn_blocking(move || load_sync(&app_data_dir)).await?
}

fn load_sync(app_data_dir: &Path) -> Result<AiMultiConfig> {
    let conn = open_db(app_data_dir)?;

    // Read meta
    let enabled = meta_get_bool(&conn, "enabled");
    let active_provider = meta_get_str(&conn, "active_provider")
        .unwrap_or_else(|| "deepseek".to_string());

    // Read providers ordered by sort_order
    let mut stmt = conn.prepare(
        "SELECT name, base_url, api_key, model, available_models, max_tokens, temperature
         FROM ai_providers
         ORDER BY sort_order ASC, name ASC",
    )?;

    let providers: Vec<AiProviderEntry> = stmt
        .query_map([], |row| {
            let available_models_json: String = row.get(4)?;
            let available_models: Vec<String> =
                serde_json::from_str(&available_models_json).unwrap_or_default();
            Ok(AiProviderEntry {
                name: row.get(0)?,
                base_url: row.get(1)?,
                api_key: row.get(2)?,
                model: row.get(3)?,
                available_models,
                max_tokens: row.get(5)?,
                temperature: row.get(6)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    if providers.is_empty() {
        // First run — return default
        return Ok(AiMultiConfig::default());
    }

    Ok(AiMultiConfig {
        enabled,
        active_provider,
        providers,
    })
}

/// Save (full replace) the multi-provider AI config to DB.
pub async fn save(app_data_dir: &Path, cfg: &AiMultiConfig) -> Result<()> {
    let app_data_dir = app_data_dir.to_path_buf();
    let cfg = cfg.clone();
    tokio::task::spawn_blocking(move || save_sync(&app_data_dir, &cfg)).await?
}

fn save_sync(app_data_dir: &Path, cfg: &AiMultiConfig) -> Result<()> {
    let conn = open_db(app_data_dir)?;

    // Upsert meta
    meta_set(&conn, "enabled", if cfg.enabled { "1" } else { "0" })?;
    meta_set(&conn, "active_provider", &cfg.active_provider)?;

    // Collect names that should exist after save
    let names: Vec<&str> = cfg.providers.iter().map(|p| p.name.as_str()).collect();

    // Delete providers that are no longer in the list
    // SQLite doesn't do DELETE … WHERE name NOT IN (?1, ?2, …) with a single
    // bind easily, so we delete all then re-insert.
    conn.execute("DELETE FROM ai_providers", [])?;

    for (i, p) in cfg.providers.iter().enumerate() {
        let available_models = serde_json::to_string(&p.available_models)?;
        conn.execute(
            "INSERT INTO ai_providers
                (name, base_url, api_key, model, available_models, max_tokens, temperature, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(name) DO UPDATE SET
                base_url         = excluded.base_url,
                api_key          = excluded.api_key,
                model            = excluded.model,
                available_models = excluded.available_models,
                max_tokens       = excluded.max_tokens,
                temperature      = excluded.temperature,
                sort_order       = excluded.sort_order",
            params![
                p.name,
                p.base_url,
                p.api_key,
                p.model,
                available_models,
                p.max_tokens,
                p.temperature,
                i as i64,
            ],
        )?;
    }

    let _ = names; // suppress unused warning
    Ok(())
}

// ─── Meta helpers ─────────────────────────────────────────────────────────────

fn meta_get_str(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM ai_meta WHERE key = ?1",
        params![key],
        |r| r.get(0),
    )
    .ok()
}

fn meta_get_bool(conn: &Connection, key: &str) -> bool {
    meta_get_str(conn, key).map(|v| v == "1").unwrap_or(false)
}

fn meta_set(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO ai_meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

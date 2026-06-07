use std::path::Path;
use anyhow::{Context, Result};
use rusqlite::{params, Connection};

use crate::models::AppConfig;

// ─── Open & migrate ───────────────────────────────────────────────────────────

pub(super) fn open_db(app_data_dir: &Path) -> Result<Connection> {
    let path = super::db_path(app_data_dir);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("无法创建数据目录: {}", parent.display()))?;
    }
    let conn = Connection::open(&path)
        .with_context(|| format!("无法打开数据库: {}", path.display()))?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;")?;
    migrate(&conn)?;
    migrate_post_process(&conn);
    let _ = migrate_ttks_to_rate_limit_rules(&conn);
    Ok(conn)
}

pub(super) fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS app_meta (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_config (
            id                          INTEGER PRIMARY KEY DEFAULT 1,
            -- paths
            base_dir                    TEXT    NOT NULL DEFAULT '',
            temp_dir                    TEXT    NOT NULL DEFAULT '',
            log_dir                     TEXT    NOT NULL DEFAULT '',
            -- network
            user_agent                  TEXT    NOT NULL DEFAULT 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            proxy                       TEXT,
            retry_count                 INTEGER NOT NULL DEFAULT 5,
            retry_delay                 INTEGER NOT NULL DEFAULT 8,
            timeout                     INTEGER NOT NULL DEFAULT 45,
            encoding_map                TEXT    NOT NULL DEFAULT '{}',
            -- concurrency
            novel_threads               INTEGER NOT NULL DEFAULT 2,
            chapter_threads             INTEGER NOT NULL DEFAULT 2,
            max_connections_per_host    INTEGER NOT NULL DEFAULT 10,
            connection_pool_size        INTEGER NOT NULL DEFAULT 50,
            -- filtering
            days_limit                  INTEGER NOT NULL DEFAULT 60,
            last_download_date          TEXT,
            min_days_limit              INTEGER NOT NULL DEFAULT 1,
            site_priority               TEXT    NOT NULL DEFAULT '{}',
            -- blacklist
            bl_enabled                  INTEGER NOT NULL DEFAULT 1,
            bl_filter_level             TEXT    NOT NULL DEFAULT 'moderate',
            bl_case_insensitive         INTEGER NOT NULL DEFAULT 1,
            bl_fuzzy_match              INTEGER NOT NULL DEFAULT 1,
            bl_regex_match              INTEGER NOT NULL DEFAULT 1,
            bl_tag_filter               INTEGER NOT NULL DEFAULT 0,
            bl_filtered_tags            TEXT    NOT NULL DEFAULT '[]',
            bl_keywords                 TEXT    NOT NULL DEFAULT '[]',
            bl_regex_patterns           TEXT    NOT NULL DEFAULT '[]',
            bl_grading_rules            TEXT    NOT NULL DEFAULT '{}',
            -- text conversion
            tc_enabled                  INTEGER NOT NULL DEFAULT 0,
            tc_t2s                      INTEGER NOT NULL DEFAULT 0,
            tc_auto                     INTEGER NOT NULL DEFAULT 1,
            -- ebook conversion
            eb_enabled                  INTEGER NOT NULL DEFAULT 0,
            eb_formats                  TEXT    NOT NULL DEFAULT '[]',
            eb_calibre                  TEXT,
            -- content filter
            cf_ad_patterns              TEXT    NOT NULL DEFAULT '[]',
            cf_nav_keywords             TEXT    NOT NULL DEFAULT '[]',
            cf_safety_threshold         REAL    NOT NULL DEFAULT 0.3,
            cf_fallback_trim_lines      INTEGER NOT NULL DEFAULT 2,
            -- ttks
            ttks_domains                TEXT    NOT NULL DEFAULT '[]',
            ttks_delay_min              INTEGER NOT NULL DEFAULT 3000,
            ttks_delay_max              INTEGER NOT NULL DEFAULT 8000,
            ttks_ua_pool                TEXT    NOT NULL DEFAULT '[]',
            -- advanced network
            an_pool_idle_timeout_secs   INTEGER NOT NULL DEFAULT 90,
            an_tcp_keepalive_secs       INTEGER NOT NULL DEFAULT 60,
            an_min_chapter_bytes        INTEGER NOT NULL DEFAULT 1024,
            an_chapter_fail_threshold   REAL    NOT NULL DEFAULT 0.05
        );

        CREATE TABLE IF NOT EXISTS rate_limit_rules (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            sort_order  INTEGER NOT NULL DEFAULT 0,
            name        TEXT    NOT NULL DEFAULT '',
            domains     TEXT    NOT NULL DEFAULT '[]',
            delay_min   INTEGER NOT NULL DEFAULT 1000,
            delay_max   INTEGER NOT NULL DEFAULT 3000,
            rps         INTEGER NOT NULL DEFAULT 0,
            ua_pool     TEXT    NOT NULL DEFAULT '[]',
            stealth     INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS websites (
            key                     TEXT PRIMARY KEY,
            enabled                 INTEGER NOT NULL DEFAULT 1,
            domain_name             TEXT    NOT NULL DEFAULT '',
            release_date            TEXT    NOT NULL DEFAULT '',
            release_url             TEXT    NOT NULL DEFAULT '',
            list_novel_name         TEXT    NOT NULL DEFAULT '',
            novel_content           TEXT    NOT NULL DEFAULT '',
            novel_name_x            TEXT    NOT NULL DEFAULT '',
            chapter_url_x           TEXT    NOT NULL DEFAULT '',
            page_list               TEXT    NOT NULL DEFAULT '[]',
            special_mode            TEXT    NOT NULL DEFAULT 'normal',
            novel_content_fallbacks TEXT    NOT NULL DEFAULT '[]',
            chapter_next_page_xpath TEXT    NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS ai_config (
            id          INTEGER PRIMARY KEY DEFAULT 1,
            enabled     INTEGER NOT NULL DEFAULT 0,
            provider    TEXT    NOT NULL DEFAULT 'deepseek',
            base_url    TEXT    NOT NULL DEFAULT '',
            api_key     TEXT    NOT NULL DEFAULT '',
            model       TEXT    NOT NULL DEFAULT '',
            max_tokens  INTEGER NOT NULL DEFAULT 2048,
            temperature REAL    NOT NULL DEFAULT 0.2
        );
        ",
    )?;
    Ok(())
}

// ─── Soft migration: post_process columns ────────────────────────────────────

fn migrate_post_process(conn: &Connection) {
    let _ = conn.execute_batch(
        "ALTER TABLE app_config ADD COLUMN pp_enabled INTEGER NOT NULL DEFAULT 0;"
    );
    let _ = conn.execute_batch(
        "ALTER TABLE app_config ADD COLUMN pp_script TEXT NOT NULL DEFAULT '';"
    );
    let _ = conn.execute_batch(
        "ALTER TABLE app_config ADD COLUMN pp_batch_done INTEGER NOT NULL DEFAULT 1;"
    );
}

// ─── Soft migration: ttks → rate_limit_rules ─────────────────────────────────

/// 一次性将旧 ttks_* 列数据迁移到 rate_limit_rules 表
fn migrate_ttks_to_rate_limit_rules(conn: &Connection) -> Result<()> {
    // 只在表为空时执行
    let already: i64 = conn
        .query_row("SELECT COUNT(*) FROM rate_limit_rules", [], |r| r.get(0))
        .unwrap_or(0);
    if already > 0 { return Ok(()); }

    // 尝试读旧 ttks_* 列（老 DB 中存在）
    let row: rusqlite::Result<(String, i64, i64, String)> = conn.query_row(
        "SELECT ttks_domains, ttks_delay_min, ttks_delay_max, ttks_ua_pool
         FROM app_config WHERE id = 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    );
    let Ok((domains_json, delay_min, delay_max, ua_pool_json)) = row else {
        return Ok(()); // 无 config 行或列不存在，跳过
    };

    let domains: Vec<String> = serde_json::from_str(&domains_json).unwrap_or_default();
    let ua_pool: Vec<String> = serde_json::from_str(&ua_pool_json).unwrap_or_default();
    // 只在有实际内容时才插入
    if domains.is_empty() && ua_pool.is_empty() { return Ok(()); }

    conn.execute(
        "INSERT INTO rate_limit_rules (sort_order, name, domains, delay_min, delay_max, rps, ua_pool, stealth)
         VALUES (0, 'TTKS（迁移）', ?1, ?2, ?3, 0, ?4, 1)",
        params![domains_json, delay_min, delay_max, ua_pool_json],
    )?;
    Ok(())
}

// ─── First-run detection ──────────────────────────────────────────────────────

/// Returns true if the user has not yet completed initial setup.
pub fn is_first_run(app_data_dir: &Path) -> bool {
    let Ok(conn) = open_db(app_data_dir) else { return true; };
    let result: rusqlite::Result<String> = conn.query_row(
        "SELECT value FROM app_meta WHERE key = 'setup_complete'",
        [],
        |row| row.get(0),
    );
    match result {
        Ok(v) => v != "1",
        Err(_) => true,
    }
}

/// Mark setup as complete (called after the onboarding wizard finishes).
pub fn mark_setup_complete(app_data_dir: &Path) -> Result<()> {
    let conn = open_db(app_data_dir)?;
    conn.execute(
        "INSERT INTO app_meta (key, value) VALUES ('setup_complete', '1')
         ON CONFLICT(key) DO UPDATE SET value = '1'",
        [],
    )?;
    Ok(())
}

// ─── Legacy migration ─────────────────────────────────────────────────────────

/// If a legacy config.yml exists next to the executable, import it into the DB
/// and rename it to config.yml.bak. Safe to call repeatedly (no-op after first run).
pub fn maybe_migrate_from_yaml(app_data_dir: &Path) {
    // Only migrate if DB has no config row yet
    let Ok(conn) = open_db(app_data_dir) else { return; };
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM app_config", [], |r| r.get(0))
        .unwrap_or(0);
    if count > 0 {
        return; // already have data
    }

    // Try to find config.yml using the legacy search logic
    let yaml_path = crate::config::config_path();
    if !yaml_path.exists() {
        return;
    }

    let Ok(content) = std::fs::read_to_string(&yaml_path) else { return; };
    let Ok(cfg) = serde_yaml::from_str::<AppConfig>(&content) else { return; };

    // Import to DB
    if super::save_config(app_data_dir, &cfg).is_ok() {
        // Rename to .bak — don't delete in case user wants to roll back
        let bak = yaml_path.with_extension("yml.bak");
        let _ = std::fs::rename(&yaml_path, &bak);
        tracing::info!("配置已从 config.yml 迁移到 SQLite，原文件重命名为 config.yml.bak");
    }
}

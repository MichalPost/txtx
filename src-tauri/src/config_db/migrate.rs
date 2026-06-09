use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use std::path::Path;

use crate::models::ContentFilterConfig;

// ─── Open & migrate ───────────────────────────────────────────────────────────

pub(super) fn open_db(app_data_dir: &Path) -> Result<Connection> {
    let path = super::db_path(app_data_dir);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("无法创建数据目录: {}", parent.display()))?;
    }
    let conn =
        Connection::open(&path).with_context(|| format!("无法打开数据库: {}", path.display()))?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;",
    )?;
    migrate(&conn)?;
    let _ = seed_content_filter_defaults(&conn);
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
            -- advanced network
            an_pool_idle_timeout_secs   INTEGER NOT NULL DEFAULT 90,
            an_tcp_keepalive_secs       INTEGER NOT NULL DEFAULT 60,
            an_min_chapter_bytes        INTEGER NOT NULL DEFAULT 1024,
            an_chapter_fail_threshold   REAL    NOT NULL DEFAULT 0.05,
            -- post-process
            pp_enabled                  INTEGER NOT NULL DEFAULT 0,
            pp_script                   TEXT    NOT NULL DEFAULT '',
            pp_batch_done               INTEGER NOT NULL DEFAULT 1
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
            chapter_next_page_xpath TEXT    NOT NULL DEFAULT '',
            encoding                TEXT    NOT NULL DEFAULT '',
            book_intro_x            TEXT    NOT NULL DEFAULT '',
            site_ad_rules           TEXT    NOT NULL DEFAULT '{}'
        );

        ",
    )?;
    Ok(())
}

// ─── Soft migration: seed content filter defaults into SQLite ────────────────

fn seed_content_filter_defaults(conn: &Connection) -> Result<()> {
    let already_seeded: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM app_meta WHERE key = 'content_filter_defaults_seeded'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if already_seeded > 0 {
        return Ok(());
    }

    let row: rusqlite::Result<(String, String)> = conn.query_row(
        "SELECT cf_ad_patterns, cf_nav_keywords FROM app_config WHERE id = 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?)),
    );
    let Ok((ad_patterns, nav_keywords)) = row else {
        return Ok(());
    };

    if ad_patterns == "[]" && nav_keywords == "[]" {
        let defaults = default_content_filter_seed();
        conn.execute(
            "UPDATE app_config
             SET cf_ad_patterns = ?1, cf_nav_keywords = ?2,
                 cf_safety_threshold = ?3, cf_fallback_trim_lines = ?4
             WHERE id = 1",
            params![
                serde_json::to_string(&defaults.ad_patterns)?,
                serde_json::to_string(&defaults.nav_keywords)?,
                defaults.safety_threshold,
                defaults.fallback_trim_lines as i64,
            ],
        )?;
    }

    conn.execute(
        "INSERT INTO app_meta (key, value) VALUES ('content_filter_defaults_seeded', '1')
         ON CONFLICT(key) DO UPDATE SET value = '1'",
        [],
    )?;
    Ok(())
}

pub(super) fn default_content_filter_seed() -> ContentFilterConfig {
    ContentFilterConfig {
        ad_patterns: vec![
            r"www\.[a-zA-Z0-9.-]+\.(com|cn|net|org|tw)".into(),
            r"QQ[：:]?\s*\d{5,}".into(),
            r"微信[：:]?\s*[a-zA-Z0-9_-]+".into(),
            r"关注.*公众号".into(),
            r"加群.*\d+".into(),
            r"更新.*最快".into(),
            r"手机.*阅读".into(),
            r"上一[篇章][：:]".into(),
            r"下一[篇章][：:]".into(),
            r"返回目录".into(),
            r"章节目录".into(),
            r"书签.*收藏".into(),
            r"加入书架".into(),
            r"本章完".into(),
        ],
        nav_keywords: vec![
            "上一篇".into(),
            "下一篇".into(),
            "上一章".into(),
            "下一章".into(),
            "返回目录".into(),
            "章节目录".into(),
            "下一节".into(),
            "上一节".into(),
            "章节列表".into(),
        ],
        ..ContentFilterConfig::default()
    }
}

// ─── First-run detection ──────────────────────────────────────────────────────

/// Returns true if the user has not yet completed initial setup.
pub fn is_first_run(app_data_dir: &Path) -> bool {
    let Ok(conn) = open_db(app_data_dir) else {
        return true;
    };
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

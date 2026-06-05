/// All-in-one config persistence — stored in {appDataDir}/txtx/app.db.
/// Replaces config/config.yml for runtime reads/writes.
/// On first launch, if a legacy config.yml is present it is migrated automatically.
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use anyhow::{Context, Result};
use rusqlite::{params, Connection};

use crate::models::{
    AppConfig, PathsConfig, NetworkConfig, ConcurrencyConfig, FilteringConfig,
    BlacklistConfig, GradingRules, WebsiteConfig,
    conversion::{TextConversionConfig, EbookConversionConfig},
    filters::{ContentFilterConfig, TtksConfig, AdvancedNetworkConfig},
};

// ─── DB path ──────────────────────────────────────────────────────────────────

/// Returns the path to app.db under the given Tauri appDataDir.
pub fn db_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("txtx").join("app.db")
}

// ─── Open & migrate ───────────────────────────────────────────────────────────

fn open_db(app_data_dir: &Path) -> Result<Connection> {
    let path = db_path(app_data_dir);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("无法创建数据目录: {}", parent.display()))?;
    }
    let conn = Connection::open(&path)
        .with_context(|| format!("无法打开数据库: {}", path.display()))?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;")?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> Result<()> {
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

// ─── Load config ──────────────────────────────────────────────────────────────

/// Load AppConfig from DB. Returns a sensible default if no row exists yet.
pub fn load_config(app_data_dir: &Path) -> Result<AppConfig> {
    let conn = open_db(app_data_dir)?;

    // Load websites
    let websites = load_websites_inner(&conn)?;

    // Load main config row
    let result = conn.query_row(
        "SELECT
            base_dir, temp_dir, log_dir,
            user_agent, proxy, retry_count, retry_delay, timeout, encoding_map,
            novel_threads, chapter_threads, max_connections_per_host, connection_pool_size,
            days_limit, last_download_date, min_days_limit, site_priority,
            bl_enabled, bl_filter_level, bl_case_insensitive, bl_fuzzy_match,
            bl_regex_match, bl_tag_filter, bl_filtered_tags, bl_keywords,
            bl_regex_patterns, bl_grading_rules,
            tc_enabled, tc_t2s, tc_auto,
            eb_enabled, eb_formats, eb_calibre,
            cf_ad_patterns, cf_nav_keywords, cf_safety_threshold, cf_fallback_trim_lines,
            ttks_domains, ttks_delay_min, ttks_delay_max, ttks_ua_pool,
            an_pool_idle_timeout_secs, an_tcp_keepalive_secs, an_min_chapter_bytes, an_chapter_fail_threshold
         FROM app_config WHERE id = 1",
        [],
        |row| row_to_config(row),
    );

    match result {
        Ok(mut cfg) => {
            cfg.websites = websites;
            Ok(cfg)
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // No config yet; return default with empty websites
            let mut cfg = default_app_config();
            cfg.websites = websites;
            Ok(cfg)
        }
        Err(e) => Err(anyhow::anyhow!(e)).context("读取配置失败"),
    }
}

fn row_to_config(row: &rusqlite::Row<'_>) -> rusqlite::Result<AppConfig> {
    let base_dir: String = row.get(0)?;
    let temp_dir: String = row.get(1)?;
    let log_dir: String = row.get(2)?;

    let user_agent: String = row.get(3)?;
    let proxy: Option<String> = row.get(4)?;
    let retry_count: u32 = row.get::<_, i64>(5)? as u32;
    let retry_delay: u64 = row.get::<_, i64>(6)? as u64;
    let timeout: u64 = row.get::<_, i64>(7)? as u64;
    let encoding_map_json: String = row.get(8)?;

    let novel_threads: usize = row.get::<_, i64>(9)? as usize;
    let chapter_threads: usize = row.get::<_, i64>(10)? as usize;
    let max_connections_per_host: usize = row.get::<_, i64>(11)? as usize;
    let connection_pool_size: usize = row.get::<_, i64>(12)? as usize;

    let days_limit: i64 = row.get(13)?;
    let last_download_date: Option<String> = row.get(14)?;
    let min_days_limit: i64 = row.get(15)?;
    let site_priority_json: String = row.get(16)?;

    let bl_enabled: bool = row.get::<_, i64>(17)? != 0;
    let bl_filter_level: String = row.get(18)?;
    let bl_case_insensitive: bool = row.get::<_, i64>(19)? != 0;
    let bl_fuzzy_match: bool = row.get::<_, i64>(20)? != 0;
    let bl_regex_match: bool = row.get::<_, i64>(21)? != 0;
    let bl_tag_filter: bool = row.get::<_, i64>(22)? != 0;
    let bl_filtered_tags_json: String = row.get(23)?;
    let bl_keywords_json: String = row.get(24)?;
    let bl_regex_patterns_json: String = row.get(25)?;
    let bl_grading_rules_json: String = row.get(26)?;

    let tc_enabled: bool = row.get::<_, i64>(27)? != 0;
    let tc_t2s: bool = row.get::<_, i64>(28)? != 0;
    let tc_auto: bool = row.get::<_, i64>(29)? != 0;

    let eb_enabled: bool = row.get::<_, i64>(30)? != 0;
    let eb_formats_json: String = row.get(31)?;
    let eb_calibre: Option<String> = row.get(32)?;

    let cf_ad_patterns_json: String = row.get(33)?;
    let cf_nav_keywords_json: String = row.get(34)?;
    let cf_safety_threshold: f64 = row.get(35)?;
    let cf_fallback_trim_lines: usize = row.get::<_, i64>(36)? as usize;


    let ttks_domains_json: String = row.get(37)?;
    let ttks_delay_min: u64 = row.get::<_, i64>(38)? as u64;
    let ttks_delay_max: u64 = row.get::<_, i64>(39)? as u64;
    let ttks_ua_pool_json: String = row.get(40)?;

    let an_pool_idle_timeout_secs: u64 = row.get::<_, i64>(41)? as u64;
    let an_tcp_keepalive_secs: u64 = row.get::<_, i64>(42)? as u64;
    let an_min_chapter_bytes: u64 = row.get::<_, i64>(43)? as u64;
    let an_chapter_fail_threshold: f64 = row.get(44)?;

    // Parse JSON fields (fall back to empty on parse error)
    let encoding_map: HashMap<String, String> =
        serde_json::from_str(&encoding_map_json).unwrap_or_default();
    let site_priority: HashMap<String, u32> =
        serde_json::from_str(&site_priority_json).unwrap_or_default();
    let bl_filtered_tags: Vec<String> =
        serde_json::from_str(&bl_filtered_tags_json).unwrap_or_default();
    let bl_keywords: Vec<String> =
        serde_json::from_str(&bl_keywords_json).unwrap_or_default();
    let bl_regex_patterns: Vec<String> =
        serde_json::from_str(&bl_regex_patterns_json).unwrap_or_default();
    let bl_grading_rules: Option<GradingRules> =
        serde_json::from_str(&bl_grading_rules_json).ok();
    let eb_formats: Vec<String> =
        serde_json::from_str(&eb_formats_json).unwrap_or_default();
    let cf_ad_patterns: Vec<String> =
        serde_json::from_str(&cf_ad_patterns_json).unwrap_or_default();
    let cf_nav_keywords: Vec<String> =
        serde_json::from_str(&cf_nav_keywords_json).unwrap_or_default();
    let ttks_domains: Vec<String> =
        serde_json::from_str(&ttks_domains_json).unwrap_or_default();
    let ttks_ua_pool: Vec<String> =
        serde_json::from_str(&ttks_ua_pool_json).unwrap_or_default();

    Ok(AppConfig {
        paths: PathsConfig { base_dir, temp_dir, log_dir },
        network: NetworkConfig {
            user_agent, proxy, retry_count, retry_delay, timeout, encoding_map,
        },
        concurrency: ConcurrencyConfig {
            novel_threads, chapter_threads, max_connections_per_host, connection_pool_size,
        },
        filtering: FilteringConfig {
            days_limit, last_download_date, min_days_limit, site_priority,
        },
        blacklist: BlacklistConfig {
            enabled: bl_enabled,
            filter_level: bl_filter_level,
            case_insensitive: bl_case_insensitive,
            fuzzy_match: bl_fuzzy_match,
            regex_match: bl_regex_match,
            tag_filter: bl_tag_filter,
            filtered_tags: bl_filtered_tags,
            keywords: bl_keywords,
            regex_patterns: bl_regex_patterns,
            grading_rules: bl_grading_rules,
        },
        websites: HashMap::new(), // filled by caller
        text_conversion: TextConversionConfig {
            enabled: tc_enabled,
            traditional_to_simplified: tc_t2s,
            auto_detect: tc_auto,
        },
        ebook_conversion: EbookConversionConfig {
            enabled: eb_enabled,
            formats: eb_formats,
            calibre_path: eb_calibre,
        },
        content_filter: ContentFilterConfig {
            ad_patterns: cf_ad_patterns,
            nav_keywords: cf_nav_keywords,
            safety_threshold: cf_safety_threshold,
            fallback_trim_lines: cf_fallback_trim_lines,
        },
        ttks: TtksConfig {
            domains: ttks_domains,
            delay_min_ms: ttks_delay_min,
            delay_max_ms: ttks_delay_max,
            requests_per_second: 0,
            ua_pool: ttks_ua_pool,
        },
        advanced_network: AdvancedNetworkConfig {
            pool_idle_timeout_secs: an_pool_idle_timeout_secs,
            tcp_keepalive_secs: an_tcp_keepalive_secs,
            min_chapter_bytes: an_min_chapter_bytes,
            chapter_fail_threshold: an_chapter_fail_threshold,
        },
    })
}

// ─── Save config ──────────────────────────────────────────────────────────────

/// Save (upsert) AppConfig to DB. Websites are saved separately per-row.
pub fn save_config(app_data_dir: &Path, config: &AppConfig) -> Result<()> {
    let conn = open_db(app_data_dir)?;

    let encoding_map = serde_json::to_string(&config.network.encoding_map)?;
    let site_priority = serde_json::to_string(&config.filtering.site_priority)?;
    let bl_filtered_tags = serde_json::to_string(&config.blacklist.filtered_tags)?;
    let bl_keywords = serde_json::to_string(&config.blacklist.keywords)?;
    let bl_regex_patterns = serde_json::to_string(&config.blacklist.regex_patterns)?;
    let bl_grading_rules = serde_json::to_string(&config.blacklist.grading_rules)?;
    let eb_formats = serde_json::to_string(&config.ebook_conversion.formats)?;
    let cf_ad_patterns = serde_json::to_string(&config.content_filter.ad_patterns)?;
    let cf_nav_keywords = serde_json::to_string(&config.content_filter.nav_keywords)?;
    let ttks_domains = serde_json::to_string(&config.ttks.domains)?;
    let ttks_ua_pool = serde_json::to_string(&config.ttks.ua_pool)?;

    conn.execute(
        "INSERT INTO app_config (
            id,
            base_dir, temp_dir, log_dir,
            user_agent, proxy, retry_count, retry_delay, timeout, encoding_map,
            novel_threads, chapter_threads, max_connections_per_host, connection_pool_size,
            days_limit, last_download_date, min_days_limit, site_priority,
            bl_enabled, bl_filter_level, bl_case_insensitive, bl_fuzzy_match,
            bl_regex_match, bl_tag_filter, bl_filtered_tags, bl_keywords,
            bl_regex_patterns, bl_grading_rules,
            tc_enabled, tc_t2s, tc_auto,
            eb_enabled, eb_formats, eb_calibre,
            cf_ad_patterns, cf_nav_keywords, cf_safety_threshold, cf_fallback_trim_lines,
            ttks_domains, ttks_delay_min, ttks_delay_max, ttks_ua_pool,
            an_pool_idle_timeout_secs, an_tcp_keepalive_secs, an_min_chapter_bytes, an_chapter_fail_threshold
         ) VALUES (
            1,
            ?1, ?2, ?3,
            ?4, ?5, ?6, ?7, ?8, ?9,
            ?10, ?11, ?12, ?13,
            ?14, ?15, ?16, ?17,
            ?18, ?19, ?20, ?21,
            ?22, ?23, ?24, ?25,
            ?26, ?27,
            ?28, ?29, ?30,
            ?31, ?32, ?33,
            ?34, ?35, ?36, ?37,
            ?38, ?39, ?40, ?41,
            ?42, ?43, ?44, ?45
         )
         ON CONFLICT(id) DO UPDATE SET
            base_dir = excluded.base_dir,
            temp_dir = excluded.temp_dir,
            log_dir = excluded.log_dir,
            user_agent = excluded.user_agent,
            proxy = excluded.proxy,
            retry_count = excluded.retry_count,
            retry_delay = excluded.retry_delay,
            timeout = excluded.timeout,
            encoding_map = excluded.encoding_map,
            novel_threads = excluded.novel_threads,
            chapter_threads = excluded.chapter_threads,
            max_connections_per_host = excluded.max_connections_per_host,
            connection_pool_size = excluded.connection_pool_size,
            days_limit = excluded.days_limit,
            last_download_date = excluded.last_download_date,
            min_days_limit = excluded.min_days_limit,
            site_priority = excluded.site_priority,
            bl_enabled = excluded.bl_enabled,
            bl_filter_level = excluded.bl_filter_level,
            bl_case_insensitive = excluded.bl_case_insensitive,
            bl_fuzzy_match = excluded.bl_fuzzy_match,
            bl_regex_match = excluded.bl_regex_match,
            bl_tag_filter = excluded.bl_tag_filter,
            bl_filtered_tags = excluded.bl_filtered_tags,
            bl_keywords = excluded.bl_keywords,
            bl_regex_patterns = excluded.bl_regex_patterns,
            bl_grading_rules = excluded.bl_grading_rules,
            tc_enabled = excluded.tc_enabled,
            tc_t2s = excluded.tc_t2s,
            tc_auto = excluded.tc_auto,
            eb_enabled = excluded.eb_enabled,
            eb_formats = excluded.eb_formats,
            eb_calibre = excluded.eb_calibre,
            cf_ad_patterns = excluded.cf_ad_patterns,
            cf_nav_keywords = excluded.cf_nav_keywords,
            cf_safety_threshold = excluded.cf_safety_threshold,
            cf_fallback_trim_lines = excluded.cf_fallback_trim_lines,
            ttks_domains = excluded.ttks_domains,
            ttks_delay_min = excluded.ttks_delay_min,
            ttks_delay_max = excluded.ttks_delay_max,
            ttks_ua_pool = excluded.ttks_ua_pool,
            an_pool_idle_timeout_secs = excluded.an_pool_idle_timeout_secs,
            an_tcp_keepalive_secs = excluded.an_tcp_keepalive_secs,
            an_min_chapter_bytes = excluded.an_min_chapter_bytes,
            an_chapter_fail_threshold = excluded.an_chapter_fail_threshold",
        params![
            config.paths.base_dir, config.paths.temp_dir, config.paths.log_dir,
            config.network.user_agent, config.network.proxy,
            config.network.retry_count as i64, config.network.retry_delay as i64,
            config.network.timeout as i64, encoding_map,
            config.concurrency.novel_threads as i64,
            config.concurrency.chapter_threads as i64,
            config.concurrency.max_connections_per_host as i64,
            config.concurrency.connection_pool_size as i64,
            config.filtering.days_limit, config.filtering.last_download_date,
            config.filtering.min_days_limit, site_priority,
            config.blacklist.enabled as i64,
            config.blacklist.filter_level,
            config.blacklist.case_insensitive as i64,
            config.blacklist.fuzzy_match as i64,
            config.blacklist.regex_match as i64,
            config.blacklist.tag_filter as i64,
            bl_filtered_tags, bl_keywords, bl_regex_patterns, bl_grading_rules,
            config.text_conversion.enabled as i64,
            config.text_conversion.traditional_to_simplified as i64,
            config.text_conversion.auto_detect as i64,
            config.ebook_conversion.enabled as i64, eb_formats,
            config.ebook_conversion.calibre_path,
            cf_ad_patterns, cf_nav_keywords,
            config.content_filter.safety_threshold,
            config.content_filter.fallback_trim_lines as i64,
            ttks_domains,
            config.ttks.delay_min_ms as i64,
            config.ttks.delay_max_ms as i64,
            ttks_ua_pool,
            config.advanced_network.pool_idle_timeout_secs as i64,
            config.advanced_network.tcp_keepalive_secs as i64,
            config.advanced_network.min_chapter_bytes as i64,
            config.advanced_network.chapter_fail_threshold,
        ],
    )?;

    // Save websites
    save_all_websites_inner(&conn, &config.websites)?;

    Ok(())
}

// ─── Websites ─────────────────────────────────────────────────────────────────

fn load_websites_inner(conn: &Connection) -> Result<HashMap<String, WebsiteConfig>> {
    // Add column if it doesn't exist yet (safe migration for existing DBs)
    let _ = conn.execute_batch(
        "ALTER TABLE websites ADD COLUMN chapter_next_page_xpath TEXT NOT NULL DEFAULT '';"
    );

    let mut stmt = conn.prepare(
        "SELECT key, enabled, domain_name, release_date, release_url, list_novel_name,
                novel_content, novel_name_x, chapter_url_x, page_list, special_mode,
                novel_content_fallbacks, chapter_next_page_xpath
         FROM websites",
    )?;
    let rows = stmt.query_map([], |row| {
        let key: String = row.get(0)?;
        let enabled: bool = row.get::<_, i64>(1)? != 0;
        let domain_name: String = row.get(2)?;
        let release_date: String = row.get(3)?;
        let release_url: String = row.get(4)?;
        let list_novel_name: String = row.get(5)?;
        let novel_content: String = row.get(6)?;
        let novel_name_x: String = row.get(7)?;
        let chapter_url_x: String = row.get(8)?;
        let page_list_json: String = row.get(9)?;
        let special_mode: String = row.get(10)?;
        let fallbacks_json: String = row.get(11)?;
        let chapter_next_page_xpath: String = row.get(12).unwrap_or_default();

        let page_list: Vec<String> = serde_json::from_str(&page_list_json).unwrap_or_default();
        let novel_content_fallbacks: Vec<String> =
            serde_json::from_str(&fallbacks_json).unwrap_or_default();

        Ok((key, WebsiteConfig {
            enabled,
            domain_name,
            release_date,
            release_url,
            list_novel_name,
            novel_content,
            novel_name_x,
            chapter_url_x,
            page_list,
            special_mode,
            novel_content_fallbacks,
            encoding: String::new(),
            chapter_next_page_xpath,
        }))
    })?;

    let mut map = HashMap::new();
    for row in rows {
        let (key, site) = row?;
        map.insert(key, site);
    }
    Ok(map)
}

/// Replace ALL website rows with the given HashMap (full sync).
fn save_all_websites_inner(
    conn: &Connection,
    websites: &HashMap<String, WebsiteConfig>,
) -> Result<()> {
    // Delete rows that no longer exist
    let keys_json = serde_json::to_string(&websites.keys().collect::<Vec<_>>())?;
    // SQLite doesn't support NOT IN with a JSON array directly, so we delete-then-insert
    conn.execute("DELETE FROM websites", [])?;

    for (key, site) in websites {
        let page_list = serde_json::to_string(&site.page_list)?;
        let fallbacks = serde_json::to_string(&site.novel_content_fallbacks)?;
        conn.execute(
            "INSERT INTO websites (key, enabled, domain_name, release_date, release_url,
                list_novel_name, novel_content, novel_name_x, chapter_url_x,
                page_list, special_mode, novel_content_fallbacks, chapter_next_page_xpath)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                key, site.enabled as i64,
                site.domain_name, site.release_date, site.release_url,
                site.list_novel_name, site.novel_content, site.novel_name_x,
                site.chapter_url_x, page_list, site.special_mode, fallbacks,
                site.chapter_next_page_xpath,
            ],
        )?;
    }
    let _ = keys_json; // suppress unused warning
    Ok(())
}

// ─── Update helpers ───────────────────────────────────────────────────────────

/// Update just the last_download_date field without rewriting the whole config.
pub fn update_last_download_date(app_data_dir: &Path, date: &str) -> Result<()> {
    let conn = open_db(app_data_dir)?;
    conn.execute(
        "UPDATE app_config SET last_download_date = ?1 WHERE id = 1",
        params![date],
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
    if save_config(app_data_dir, &cfg).is_ok() {
        // Rename to .bak — don't delete in case user wants to roll back
        let bak = yaml_path.with_extension("yml.bak");
        let _ = std::fs::rename(&yaml_path, &bak);
        tracing::info!("配置已从 config.yml 迁移到 SQLite，原文件重命名为 config.yml.bak");
    }
}

// ─── Default AppConfig ────────────────────────────────────────────────────────

fn default_app_config() -> AppConfig {
    AppConfig {
        paths: PathsConfig {
            base_dir: String::new(),
            temp_dir: String::new(),
            log_dir: String::new(),
        },
        network: NetworkConfig::default(),
        concurrency: ConcurrencyConfig::default(),
        filtering: FilteringConfig::default(),
        blacklist: BlacklistConfig {
            enabled: true,
            filter_level: "moderate".into(),
            case_insensitive: true,
            fuzzy_match: true,
            regex_match: true,
            tag_filter: false,
            filtered_tags: vec![],
            keywords: vec![],
            regex_patterns: vec![],
            grading_rules: None,
        },
        websites: HashMap::new(),
        text_conversion: TextConversionConfig::default(),
        ebook_conversion: EbookConversionConfig::default(),
        content_filter: ContentFilterConfig::default(),
        ttks: TtksConfig::default(),
        advanced_network: AdvancedNetworkConfig::default(),
    }
}

/// All-in-one config persistence — stored in {appDataDir}/txtx/app.db.
/// Replaces config/config.yml for runtime reads/writes.
/// On first launch, if a legacy config.yml is present it is migrated automatically.
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use anyhow::{Context, Result};
use rusqlite::params;

use crate::models::{
    AppConfig, PathsConfig, NetworkConfig, ConcurrencyConfig, FilteringConfig,
    BlacklistConfig, GradingRules,
    conversion::{TextConversionConfig, EbookConversionConfig},
    filters::{ContentFilterConfig, RateLimitConfig, AdvancedNetworkConfig},
};

mod migrate;
mod websites;

pub use migrate::{is_first_run, mark_setup_complete, maybe_migrate_from_yaml};

use migrate::open_db;
use websites::{load_websites_inner, save_all_websites_inner, save_rate_limit_rules, load_rate_limit_rules};

// ─── DB path ──────────────────────────────────────────────────────────────────

/// Returns the path to app.db under the given Tauri appDataDir.
pub fn db_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("txtx").join("app.db")
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
            an_pool_idle_timeout_secs, an_tcp_keepalive_secs, an_min_chapter_bytes, an_chapter_fail_threshold
         FROM app_config WHERE id = 1",
        [],
        |row| row_to_config(row),
    );

    match result {
        Ok(mut cfg) => {
            cfg.websites = websites;
            cfg.rate_limit.rules = load_rate_limit_rules(&conn);
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


    let an_pool_idle_timeout_secs: u64 = row.get::<_, i64>(37)? as u64;
    let an_tcp_keepalive_secs: u64 = row.get::<_, i64>(38)? as u64;
    let an_min_chapter_bytes: u64 = row.get::<_, i64>(39)? as u64;
    let an_chapter_fail_threshold: f64 = row.get(40)?;

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
        rate_limit: RateLimitConfig::default(), // 规则由 load_config 的调用层填充
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
            ?38, ?39, ?40, ?41
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
            config.advanced_network.pool_idle_timeout_secs as i64,
            config.advanced_network.tcp_keepalive_secs as i64,
            config.advanced_network.min_chapter_bytes as i64,
            config.advanced_network.chapter_fail_threshold,
        ],
    )?;

    // Save websites
    save_all_websites_inner(&conn, &config.websites)?;

    // Save rate limit rules
    save_rate_limit_rules(&conn, &config.rate_limit.rules)?;

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
        rate_limit: RateLimitConfig::default(),
        advanced_network: AdvancedNetworkConfig::default(),
    }
}

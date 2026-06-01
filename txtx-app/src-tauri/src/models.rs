use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─── Config ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathsConfig {
    pub base_dir: String,
    #[serde(default = "default_temp_dir")]
    pub temp_dir: String,
    #[serde(default = "default_log_dir")]
    pub log_dir: String,
}

fn default_temp_dir() -> String { "E:/Downloads/xs/temp".into() }
fn default_log_dir() -> String { "E:/Downloads/xs/logs".into() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig {
    #[serde(default = "default_ua")]
    pub user_agent: String,
    #[serde(default)]
    pub proxy: Option<String>,
    #[serde(default = "default_retry_count")]
    pub retry_count: u32,
    #[serde(default = "default_retry_delay")]
    pub retry_delay: u64,
    #[serde(default = "default_timeout")]
    pub timeout: u64,
    #[serde(default)]
    pub encoding_map: HashMap<String, String>,
}

fn default_ua() -> String {
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36".into()
}
fn default_retry_count() -> u32 { 5 }
fn default_retry_delay() -> u64 { 8 }
fn default_timeout() -> u64 { 45 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcurrencyConfig {
    #[serde(default = "default_novel_threads")]
    pub novel_threads: usize,
    #[serde(default = "default_chapter_threads")]
    pub chapter_threads: usize,
    #[serde(default = "default_max_conn")]
    pub max_connections_per_host: usize,
    #[serde(default = "default_pool_size")]
    pub connection_pool_size: usize,
}

fn default_novel_threads() -> usize { 2 }
fn default_chapter_threads() -> usize { 2 }
fn default_max_conn() -> usize { 10 }
fn default_pool_size() -> usize { 50 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilteringConfig {
    #[serde(default = "default_days_limit")]
    pub days_limit: i64,
    #[serde(default)]
    pub last_download_date: Option<String>,
    #[serde(default = "default_min_days")]
    pub min_days_limit: i64,
    #[serde(default)]
    pub site_priority: HashMap<String, u32>,
}

fn default_days_limit() -> i64 { 60 }
fn default_min_days() -> i64 { 1 }

// ─── Text conversion config ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TextConversionConfig {
    #[serde(default)]
    pub enabled: bool,
    /// Convert traditional Chinese to simplified
    #[serde(default)]
    pub traditional_to_simplified: bool,
    /// Auto-detect whether conversion is needed
    #[serde(default = "default_true")]
    pub auto_detect: bool,
}

// ─── Ebook conversion config ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EbookConversionConfig {
    #[serde(default)]
    pub enabled: bool,
    /// Formats to convert to: "epub", "mobi"
    #[serde(default)]
    pub formats: Vec<String>,
    /// Path to calibre's ebook-convert binary (optional, auto-detected if empty)
    #[serde(default)]
    pub calibre_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GradingRules {
    #[serde(default)]
    pub strict: Vec<String>,
    #[serde(default)]
    pub moderate: Vec<String>,
    #[serde(default)]
    pub mild: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlacklistConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_filter_level")]
    pub filter_level: String,
    #[serde(default = "default_true")]
    pub case_insensitive: bool,
    #[serde(default = "default_true")]
    pub fuzzy_match: bool,
    #[serde(default = "default_true")]
    pub regex_match: bool,
    #[serde(default)]
    pub tag_filter: bool,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default)]
    pub regex_patterns: Vec<String>,
    #[serde(default)]
    pub grading_rules: Option<GradingRules>,
}

fn default_true() -> bool { true }
fn default_filter_level() -> String { "moderate".into() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebsiteConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub domain_name: String,
    pub release_date: String,
    pub release_url: String,
    #[serde(default)]
    pub list_novel_name: String,
    pub novel_content: String,
    pub novel_name_x: String,
    pub chapter_url_x: String,
    pub page_list: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub paths: PathsConfig,
    #[serde(default)]
    pub network: NetworkConfig,
    #[serde(default)]
    pub concurrency: ConcurrencyConfig,
    #[serde(default)]
    pub filtering: FilteringConfig,
    pub blacklist: BlacklistConfig,
    pub websites: HashMap<String, WebsiteConfig>,
    #[serde(default)]
    pub text_conversion: TextConversionConfig,
    #[serde(default)]
    pub ebook_conversion: EbookConversionConfig,
}

impl Default for NetworkConfig {
    fn default() -> Self {
        Self {
            user_agent: default_ua(),
            proxy: None,
            retry_count: default_retry_count(),
            retry_delay: default_retry_delay(),
            timeout: default_timeout(),
            encoding_map: HashMap::new(),
        }
    }
}

impl Default for ConcurrencyConfig {
    fn default() -> Self {
        Self {
            novel_threads: default_novel_threads(),
            chapter_threads: default_chapter_threads(),
            max_connections_per_host: default_max_conn(),
            connection_pool_size: default_pool_size(),
        }
    }
}

impl Default for FilteringConfig {
    fn default() -> Self {
        Self {
            days_limit: default_days_limit(),
            last_download_date: None,
            min_days_limit: default_min_days(),
            site_priority: HashMap::new(),
        }
    }
}

// ─── Runtime types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookCandidate {
    pub name: String,
    pub url: String,
    pub crawler_domain: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadStats {
    pub total_collected: usize,
    pub after_dedup: usize,
    pub blacklist_filtered: usize,
    pub local_exists: usize,
    pub final_download: usize,
}

/// Result of a site health check ping
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteHealth {
    pub domain: String,
    pub reachable: bool,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
}

/// A single scanned novel candidate with filter metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanItem {
    pub name: String,
    pub url: String,
    pub site: String,
    pub date: String,
    /// Why this item was excluded (None = included in download list)
    pub excluded_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ProgressEvent {
    Log {
        message: String,
        level: String,
    },
    ScanStart {
        site: String,
    },
    ScanDone {
        site: String,
        total: usize,
    },
    FilterDone {
        stats: DownloadStats,
    },
    NovelStart {
        novel: String,
        site: String,
    },
    /// Emitted each time a chapter finishes downloading
    ChapterDone {
        novel: String,
        current: usize,
        total: usize,
    },
    NovelDone {
        novel: String,
        site: String,
    },
    NovelError {
        novel: String,
        site: String,
        message: String,
    },
    OverallDone,
    /// Emitted after scan+filter completes, carries the full item list
    ScanComplete {
        items: Vec<ScanItem>,
        stats: DownloadStats,
    },
}

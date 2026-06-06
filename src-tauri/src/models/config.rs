use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::models::conversion::{TextConversionConfig, EbookConversionConfig};
use crate::models::filters::{ContentFilterConfig, RateLimitConfig, AdvancedNetworkConfig};

pub(crate) fn default_true() -> bool { true }

// ─── Paths ────────────────────────────────────────────────────────────────────

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

// ─── Network ──────────────────────────────────────────────────────────────────

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

// ─── Concurrency ──────────────────────────────────────────────────────────────

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

// ─── Filtering ────────────────────────────────────────────────────────────────

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

// ─── Blacklist ────────────────────────────────────────────────────────────────

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
    pub filtered_tags: Vec<String>,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default)]
    pub regex_patterns: Vec<String>,
    #[serde(default)]
    pub grading_rules: Option<GradingRules>,
}

fn default_filter_level() -> String { "moderate".into() }

// ─── Website ──────────────────────────────────────────────────────────────────

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
    #[serde(default = "default_special_mode")]
    pub special_mode: String,
    #[serde(default)]
    pub novel_content_fallbacks: Vec<String>,
    #[serde(default)]
    pub encoding: String,
    /// XPath to locate the "next page" link within a chapter page.
    /// When non-empty, the downloader follows these links and concatenates
    /// content across all sub-pages before writing the chapter file.
    #[serde(default)]
    pub chapter_next_page_xpath: String,
}

fn default_special_mode() -> String { "normal".into() }

// ─── AppConfig ────────────────────────────────────────────────────────────────

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
    #[serde(default)]
    pub content_filter: ContentFilterConfig,
    #[serde(default, alias = "ttks")]
    pub rate_limit: RateLimitConfig,
    #[serde(default)]
    pub advanced_network: AdvancedNetworkConfig,
}

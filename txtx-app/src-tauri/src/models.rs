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

/// 内容过滤配置（广告/导航行清除规则）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentFilterConfig {
    /// 正则广告过滤模式（逐行匹配，命中即删除该行）
    #[serde(default = "default_ad_patterns")]
    pub ad_patterns: Vec<String>,
    /// 末尾导航行关键词（从末尾向前循环剥离）
    #[serde(default = "default_nav_keywords")]
    pub nav_keywords: Vec<String>,
    /// 安全回退阈值：过滤后内容 < 原始的此比例则回退（0.0~1.0）
    #[serde(default = "default_safety_threshold")]
    pub safety_threshold: f64,
    /// 安全回退时末尾删除行数
    #[serde(default = "default_fallback_trim")]
    pub fallback_trim_lines: usize,
}

fn default_ad_patterns() -> Vec<String> {
    vec![
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
    ]
}

fn default_nav_keywords() -> Vec<String> {
    vec![
        "上一篇".into(), "下一篇".into(), "上一章".into(), "下一章".into(),
        "返回目录".into(), "章节目录".into(), "下一节".into(), "上一节".into(),
        "章节列表".into(),
    ]
}

fn default_safety_threshold() -> f64 { 0.3 }
fn default_fallback_trim() -> usize { 2 }

impl Default for ContentFilterConfig {
    fn default() -> Self {
        Self {
            ad_patterns: default_ad_patterns(),
            nav_keywords: default_nav_keywords(),
            safety_threshold: default_safety_threshold(),
            fallback_trim_lines: default_fallback_trim(),
        }
    }
}

/// TTKS 专用下载配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtksConfig {
    /// 识别为 TTKS 站点的域名特征列表
    #[serde(default = "default_ttks_domains")]
    pub domains: Vec<String>,
    /// 章节间最小延迟（毫秒）
    #[serde(default = "default_ttks_delay_min")]
    pub delay_min_ms: u64,
    /// 章节间最大延迟（毫秒）
    #[serde(default = "default_ttks_delay_max")]
    pub delay_max_ms: u64,
    /// 每秒最大请求数。0 = 禁用（回退到随机 delay_min/max 延迟）
    #[serde(default = "default_ttks_rps")]
    pub requests_per_second: u32,
    /// 随机 User-Agent 池（轮换使用）
    #[serde(default = "default_ttks_ua_pool")]
    pub ua_pool: Vec<String>,
}

fn default_ttks_domains() -> Vec<String> {
    vec!["ttks.tw".into(), "ttks.cc".into(), "ttks.me".into()]
}
fn default_ttks_delay_min() -> u64 { 3_000 }
fn default_ttks_delay_max() -> u64 { 8_000 }
fn default_ttks_rps() -> u32 { 0 }
fn default_ttks_ua_pool() -> Vec<String> {
    vec![
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36".into(),
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0".into(),
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36".into(),
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0".into(),
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36".into(),
    ]
}

impl Default for TtksConfig {
    fn default() -> Self {
        Self {
            domains: default_ttks_domains(),
            delay_min_ms: default_ttks_delay_min(),
            delay_max_ms: default_ttks_delay_max(),
            requests_per_second: default_ttks_rps(),
            ua_pool: default_ttks_ua_pool(),
        }
    }
}

/// 高级网络参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvancedNetworkConfig {
    /// 连接池空闲超时（秒）
    #[serde(default = "default_pool_idle_timeout")]
    pub pool_idle_timeout_secs: u64,
    /// TCP keepalive（秒）
    #[serde(default = "default_tcp_keepalive")]
    pub tcp_keepalive_secs: u64,
    /// 小文件阈值（字节）：章节文件小于此值视为下载失败需修复
    #[serde(default = "default_min_chapter_bytes")]
    pub min_chapter_bytes: u64,
    /// 章节失败率阈值（0.0~1.0）：超过此比例则整本小说标记失败
    #[serde(default = "default_chapter_fail_threshold")]
    pub chapter_fail_threshold: f64,
}

fn default_pool_idle_timeout() -> u64 { 90 }
fn default_tcp_keepalive() -> u64 { 60 }
fn default_min_chapter_bytes() -> u64 { 1024 }
fn default_chapter_fail_threshold() -> f64 { 0.05 }

impl Default for AdvancedNetworkConfig {
    fn default() -> Self {
        Self {
            pool_idle_timeout_secs: default_pool_idle_timeout(),
            tcp_keepalive_secs: default_tcp_keepalive(),
            min_chapter_bytes: default_min_chapter_bytes(),
            chapter_fail_threshold: default_chapter_fail_threshold(),
        }
    }
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
    pub filtered_tags: Vec<String>,
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
    /// 特殊下载模式: "normal" | "ttks"
    #[serde(default = "default_special_mode")]
    pub special_mode: String,
    /// 内容 XPath 备用规则列表（换行分隔），后端按顺序尝试直到有内容
    #[serde(default)]
    pub novel_content_fallbacks: Vec<String>,
}

fn default_special_mode() -> String { "normal".into() }

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
    #[serde(default)]
    pub ttks: TtksConfig,
    #[serde(default)]
    pub advanced_network: AdvancedNetworkConfig,
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

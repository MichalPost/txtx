use serde::{Deserialize, Serialize};

// ─── ContentFilterConfig ──────────────────────────────────────────────────────

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

// ─── TtksConfig ───────────────────────────────────────────────────────────────

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

// ─── AdvancedNetworkConfig ────────────────────────────────────────────────────

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

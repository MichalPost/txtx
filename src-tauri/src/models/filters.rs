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

// ─── RateLimitRule / RateLimitConfig ──────────────────────────────────────────

/// 单条站点限速规则（任意站点均可添加）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitRule {
    /// 规则名称（显示用）
    #[serde(default)]
    pub name: String,
    /// 命中此规则的域名特征列表（URL contains any）
    #[serde(default)]
    pub domains: Vec<String>,
    /// 章节间最小延迟（毫秒）；0 = 不延迟
    #[serde(default = "default_rl_delay_min")]
    pub delay_min_ms: u64,
    /// 章节间最大延迟（毫秒）；等于 delay_min_ms 时为固定延迟
    #[serde(default = "default_rl_delay_max")]
    pub delay_max_ms: u64,
    /// 每秒最大请求数；0 = 禁用（退回随机延迟）
    #[serde(default)]
    pub requests_per_second: u32,
    /// 随机 UA 池（空 = 使用全局 user_agent）
    #[serde(default)]
    pub ua_pool: Vec<String>,
    /// 启用 stealth TLS 指纹（wreq）；false = 标准 reqwest
    #[serde(default = "default_true_bool")]
    pub stealth: bool,
}

fn default_rl_delay_min() -> u64 { 1_000 }
fn default_rl_delay_max() -> u64 { 3_000 }
fn default_true_bool() -> bool { true }

impl Default for RateLimitRule {
    fn default() -> Self {
        Self {
            name: String::new(),
            domains: vec![],
            delay_min_ms: default_rl_delay_min(),
            delay_max_ms: default_rl_delay_max(),
            requests_per_second: 0,
            ua_pool: vec![],
            stealth: true,
        }
    }
}

/// 全部站点限速规则（替代原 TtksConfig）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RateLimitConfig {
    /// 规则列表，按顺序匹配，命中第一条即停
    #[serde(default)]
    pub rules: Vec<RateLimitRule>,
}

/// 向后兼容：从旧 ttks yaml/json 迁移
pub fn ttks_to_rate_limit(
    domains: Vec<String>,
    delay_min: u64,
    delay_max: u64,
    rps: u32,
    ua_pool: Vec<String>,
) -> RateLimitConfig {
    if domains.is_empty() && ua_pool.is_empty() {
        return RateLimitConfig::default();
    }
    RateLimitConfig {
        rules: vec![RateLimitRule {
            name: "TTKS（迁移）".into(),
            domains,
            delay_min_ms: delay_min,
            delay_max_ms: delay_max,
            requests_per_second: rps,
            ua_pool,
            stealth: true,
        }],
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

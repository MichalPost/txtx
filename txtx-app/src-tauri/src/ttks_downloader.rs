//! TTKS 专用下载处理模块
//! ttks.tw 及同系列站点具有较强的反爬机制：
//!   - 随机延迟防高频请求
//!   - 多 User-Agent 轮换
//!   - 额外 HTTP headers（Referer / Sec-Fetch / Accept-Language）
//!   - 专用广告过滤规则（繁体 + 简体双版本）
//!
//! 注: wreq/BoringSSL TLS 指纹模拟功能当前以 reqwest 替代，
//!     可在 CI/Release 环境配置 BoringSSL 后切换回 wreq。

use anyhow::Result;
use rand::Rng;
use regex::Regex;
use reqwest::Client;
use scraper::Html;
use std::collections::HashMap;
use std::time::Duration;
use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;
use std::sync::OnceLock;
use tokio::time::sleep;

type DirectRl = RateLimiter<
    governor::state::NotKeyed,
    governor::state::InMemoryState,
    governor::clock::DefaultClock,
>;

/// 返回全局共享的 TTKS 限速器（懒初始化，线程安全）。
/// rps = 0 时返回 None，调用方回退到随机延迟。
fn get_rate_limiter(rps: u32) -> Option<&'static DirectRl> {
    static RL: OnceLock<DirectRl> = OnceLock::new();
    if rps == 0 {
        return None;
    }
    let n = NonZeroU32::new(rps).unwrap_or(NonZeroU32::new(1).unwrap());
    Some(RL.get_or_init(|| {
        RateLimiter::direct(Quota::per_second(n))
    }))
}

/// 判断 URL 是否属于 TTKS 系列站点（从配置读取域名列表）
pub fn is_ttks_url(url: &str, ttks_cfg: &crate::models::TtksConfig) -> bool {
    ttks_cfg.domains.iter().any(|d| url.contains(d.as_str()))
}

/// 构造 TTKS 专用 HTTP 客户端，使用随机 UA 和浏览器特征 headers。
/// （未来可切换到 wreq 以获得 TLS 指纹模拟）
pub fn build_ttks_client(proxy: Option<&str>, timeout: u64, ttks_cfg: &crate::models::TtksConfig) -> Result<Client> {
    // 随机选取 UA
    let idx = rand::thread_rng().gen_range(0..ttks_cfg.ua_pool.len().max(1));
    let ua = ttks_cfg.ua_pool.get(idx).map(|s| s.as_str()).unwrap_or(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
    );

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Accept-Language", "zh-TW,zh;q=0.9,en;q=0.8".parse().unwrap());
    headers.insert("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8".parse().unwrap());
    headers.insert("Cache-Control", "no-cache".parse().unwrap());

    let mut builder = Client::builder()
        .user_agent(ua)
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(timeout))
        .gzip(true);

    if let Some(p) = proxy {
        if !p.is_empty() {
            builder = builder.proxy(reqwest::Proxy::all(p)?);
        }
    }
    Ok(builder.build()?)
}

/// 下载 TTKS 章节，含随机延迟（从配置读取范围）防封
pub async fn fetch_ttks_chapter(
    client: &Client,
    url: &str,
    domain: &str,
    content_xpath: &str,
    xpath_fallbacks: &[String],
    encoding_map: &HashMap<String, String>,
    retry_count: u32,
    retry_delay: u64,
    ttks_cfg: &crate::models::TtksConfig,
    filter: &crate::models::ContentFilterConfig,
) -> Result<String> {
    // 优先使用 token-bucket 限速（精确），fallback 到随机延迟
    if let Some(rl) = get_rate_limiter(ttks_cfg.requests_per_second) {
        rl.until_ready().await;
    } else {
        let delay_ms = if ttks_cfg.delay_max_ms > ttks_cfg.delay_min_ms {
            rand::thread_rng().gen_range(ttks_cfg.delay_min_ms..ttks_cfg.delay_max_ms)
        } else {
            ttks_cfg.delay_min_ms
        };
        sleep(Duration::from_millis(delay_ms)).await;
    }

    let referer = format!("{}/", domain.trim_end_matches('/'));
    let bytes = {
        let mut attempts = 0u32;
        loop {
            let result = client
                .get(url)
                .header("Referer", &referer)
                .header("Sec-Fetch-Dest", "document")
                .header("Sec-Fetch-Mode", "navigate")
                .header("Sec-Fetch-Site", "same-origin")
                .send()
                .await;
            match result {
                Ok(r) => break r.bytes().await?,
                Err(e) => {
                    attempts += 1;
                    if attempts >= retry_count {
                        return Err(e.into());
                    }
                    sleep(Duration::from_secs(retry_delay * attempts as u64)).await;
                }
            }
        }
    };

    let enc_name = encoding_map
        .get(&crate::crawler::extract_domain_pub(url))
        .map(|s| s.as_str())
        .unwrap_or("utf-8");
    let encoding = encoding_rs::Encoding::for_label(enc_name.as_bytes())
        .unwrap_or(encoding_rs::UTF_8);
    let (text, _, _) = encoding.decode(&bytes);
    let html_str = text.into_owned();

    let html = Html::parse_document(&html_str);
    // Try primary xpath first, then fallbacks
    let parts = crate::crawler::xpath_texts_pub(&html, content_xpath);
    if !parts.is_empty() {
        return Ok(filter_ttks_content_with_config(parts, filter));
    }
    for fb_xpath in xpath_fallbacks {
        if fb_xpath.trim().is_empty() { continue; }
        let fb_parts = crate::crawler::xpath_texts_pub(&html, fb_xpath.trim());
        if !fb_parts.is_empty() {
            return Ok(filter_ttks_content_with_config(fb_parts, filter));
        }
    }
    Ok(String::new())
}


/// TTKS 专用广告过滤，结合通用 ContentFilterConfig 使用配置规则
fn filter_ttks_content_with_config(parts: Vec<String>, filter: &crate::models::ContentFilterConfig) -> String {
    if parts.is_empty() { return String::new(); }

    // TTKS 额外的繁体规则 + config 规则合并
    let ttks_extra = [
        r"ttks\.(tw|cc|me)",
        r"https?://[a-zA-Z0-9.-]+",
        r"关注.*公众号|關注.*公眾號",
        r"手[机機].*[阅閱][读讀]",
        r"上一[篇章節节][：:]?",
        r"下一[篇章節节][：:]?",
        r"返回目[錄录]",
        r"章節目[錄录]",
        r"書簽|书签|收藏",
        r"加入書架|加入书架",
        r"本章完|本節完",
        r"[請请][記记]住",
        r"最新章[節节]",
        r"點擊下一章|点击下一章",
        r"[繼继][續续][阅閱][讀读]",
        r"歡迎光臨|欢迎光临",
        r"版[權权]所有",
        r"未[經经]授[權权]",
    ];

    // Compile config patterns + TTKS extra
    let compiled: Vec<Regex> = filter.ad_patterns.iter().map(|s| s.as_str())
        .chain(ttks_extra.iter().copied())
        .filter_map(|p| Regex::new(p).ok())
        .collect();

    let cleaned: Vec<String> = parts.into_iter()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    if cleaned.is_empty() { return String::new(); }
    let original_count = cleaned.len();

    let mut filtered: Vec<String> = cleaned.iter()
        .filter(|line| !compiled.iter().any(|re| re.is_match(line)))
        .cloned()
        .collect();

    // Tail nav strip with both simp+trad keywords
    let extra_nav = ["上一節", "下一節", "返回目錄", "章節目錄"];
    loop {
        let done = match filtered.last() {
            Some(last) => {
                let hit_config = filter.nav_keywords.iter().any(|kw| last.contains(kw.as_str()));
                let hit_extra = extra_nav.iter().any(|kw| last.contains(kw));
                !(hit_config || hit_extra)
            }
            None => true,
        };
        if done { break; }
        filtered.pop();
    }

    if !filtered.is_empty() && (filtered.len() as f64) < (original_count as f64) * filter.safety_threshold {
        return String::new(); // trigger retry at caller level
    }

    filtered.join("\n")
}
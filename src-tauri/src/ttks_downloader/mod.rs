//! TTKS 专用下载处理模块
//! ttks.tw 及同系列站点具有较强的反爬机制：
//!   - 随机延迟防高频请求
//!   - 多 User-Agent 轮换
//!   - 额外 HTTP headers（Referer / Sec-Fetch / Accept-Language）
//!   - 专用广告过滤规则（繁体 + 简体双版本）
//!
//! stealth 模式（默认启用）：使用 wreq + BoringSSL 模拟 Chrome TLS 指纹，
//! 绕过基于 JA3/JA4 的反爬检测（如 Cloudflare）。
//! 若编译时不带 stealth feature，自动退化为标准 reqwest 客户端。

pub mod client;

pub use client::TtksClient;

use anyhow::Result;
use rand::Rng;
use regex::Regex;
use scraper::Html;
use std::collections::HashMap;
use std::time::Duration;
use tokio::time::sleep;

use client::get_rate_limiter;

/// 查找 URL 匹配的第一条限速规则；未匹配时返回 None（走标准下载路径）
pub fn find_rate_limit_rule<'a>(
    url: &str,
    cfg: &'a crate::models::RateLimitConfig,
) -> Option<&'a crate::models::filters::RateLimitRule> {
    cfg.rules.iter().find(|r| {
        !r.domains.is_empty() && r.domains.iter().any(|d| url.contains(d.as_str()))
    })
}

/// 构造限速专用 HTTP 客户端。
///
/// 启用 stealth feature 时返回 wreq::Client（BoringSSL + Chrome TLS 指纹），
/// 可绕过基于 JA3/JA4 的反爬检测。否则退化为标准 reqwest::Client。
pub fn build_ttks_client(
    proxy: Option<&str>,
    timeout: u64,
    rule: &crate::models::filters::RateLimitRule,
) -> Result<TtksClient> {
    let idx = rand::thread_rng().gen_range(0..rule.ua_pool.len().max(1));
    let ua = rule.ua_pool.get(idx).map(|s| s.as_str()).unwrap_or(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    );

    #[cfg(feature = "stealth")]
    if rule.stealth {
        match client::stealth_client::build(ua, proxy, timeout) {
            Ok(c) => {
                tracing::debug!("RateLimit: stealth client (UA: {})", &ua[..ua.len().min(40)]);
                return Ok(TtksClient::Stealth(c));
            }
            Err(e) => {
                tracing::warn!("RateLimit: wreq failed ({}), falling back to reqwest", e);
            }
        }
    }

    // fallback: 标准 reqwest
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Accept-Language", "zh-TW,zh;q=0.9,en;q=0.8".parse().unwrap());
    headers.insert("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8".parse().unwrap());
    headers.insert("Cache-Control", "no-cache".parse().unwrap());

    let mut builder = reqwest::Client::builder()
        .user_agent(ua)
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(timeout))
        .gzip(true);

    if let Some(p) = proxy {
        if !p.is_empty() {
            builder = builder.proxy(reqwest::Proxy::all(p)?);
        }
    }
    Ok(TtksClient::Standard(builder.build()?))
}

/// 下载限速章节，含精确限速（governor token-bucket）或随机延迟防封
pub async fn fetch_ttks_chapter(
    client: &TtksClient,
    url: &str,
    domain: &str,
    content_xpath: &str,
    xpath_fallbacks: &[String],
    encoding_map: &HashMap<String, String>,
    retry_count: u32,
    retry_delay: u64,
    rule: &crate::models::filters::RateLimitRule,
    filter: &crate::models::ContentFilterConfig,
) -> Result<String> {
    // 优先使用 token-bucket 限速（精确），fallback 到随机延迟
    if let Some(rl) = get_rate_limiter(rule.requests_per_second) {
        rl.until_ready().await;
    } else {
        let delay_ms = if rule.delay_max_ms > rule.delay_min_ms {
            rand::thread_rng().gen_range(rule.delay_min_ms..rule.delay_max_ms)
        } else {
            rule.delay_min_ms
        };
        sleep(Duration::from_millis(delay_ms)).await;
    }

    let referer = format!("{}/", domain.trim_end_matches('/'));
    let bytes = client.get_bytes(url, &referer, retry_count, retry_delay).await?;

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

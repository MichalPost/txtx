use std::collections::HashMap;
use anyhow::Result;
use backon::{ExponentialBuilder, Retryable};
use reqwest::Client;
use scraper::{Html, Selector};
use sxd_xpath::evaluate_xpath;
use encoding_rs::Encoding;
use regex::Regex;
use crate::models::{WebsiteConfig, NetworkConfig, BookCandidate};

/// Build a reqwest client with the given network config.
/// `pool_size` 为每个 host 的最大空闲连接数，传 None 使用默认值 10。
pub fn build_client(net: &NetworkConfig) -> Result<Client> {
    build_client_with_pool(net, 10)
}

/// Build a reqwest client，支持自定义连接池大小。
pub fn build_client_with_pool(net: &NetworkConfig, pool_max_idle_per_host: usize) -> Result<Client> {
    let mut builder = Client::builder()
        .user_agent(&net.user_agent)
        .timeout(std::time::Duration::from_secs(net.timeout))
        // 连接池：最大空闲连接数
        .pool_max_idle_per_host(pool_max_idle_per_host)
        .pool_idle_timeout(std::time::Duration::from_secs(90))
        .tcp_keepalive(std::time::Duration::from_secs(60))
        .gzip(true)
        .brotli(true)
        .deflate(true);

    if let Some(proxy_url) = &net.proxy {
        if !proxy_url.is_empty() {
            builder = builder.proxy(reqwest::Proxy::all(proxy_url)?);
        }
    }

    Ok(builder.build()?)
}

/// Fetch a URL and decode the response body using the encoding map.
pub async fn fetch_page(
    client: &Client,
    url: &str,
    encoding_map: &HashMap<String, String>,
    retry_count: u32,
    retry_delay: u64,
) -> Result<String> {
    let domain = extract_domain(url);
    let enc_name = encoding_map
        .get(&domain)
        .map(|s| s.clone())
        .unwrap_or_else(|| "utf-8".to_string());

    // 构造同域 Referer
    let referer = {
        let domain_part = url.split("://").nth(1).unwrap_or("").split('/').next().unwrap_or("");
        let scheme = if url.starts_with("https") { "https" } else { "http" };
        format!("{}://{}/", scheme, domain_part)
    };

    let fetch = || async {
        let resp = client.get(url)
            .header("Referer", &referer)
            .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .send()
            .await?;
        let bytes = resp.bytes().await?;
        let encoding = Encoding::for_label(enc_name.as_bytes())
            .unwrap_or(encoding_rs::UTF_8);
        let (text, _, _) = encoding.decode(&bytes);
        Ok::<String, anyhow::Error>(text.into_owned())
    };

    fetch
        .retry(
            ExponentialBuilder::default()
                .with_max_times(retry_count as usize)
                .with_min_delay(std::time::Duration::from_secs(retry_delay)),
        )
        .await
}

fn extract_domain(url: &str) -> String {
    // e.g. "https://ffxs8.com/..." -> "ffxs8.com"
    url.split("://")
        .nth(1)
        .unwrap_or("")
        .split('/')
        .next()
        .unwrap_or("")
        .to_string()
}

/// 公共版本供其他模块调用
pub fn extract_domain_pub(url: &str) -> String {
    extract_domain(url)
}

/// XPath-like text extraction using CSS-style scraper.
/// We translate simple XPath text() and @attr patterns to scraper selectors.
/// For complex XPath we fall back to a best-effort approach.
pub fn xpath_texts(html: &Html, xpath: &str) -> Vec<String> {
    // Try to convert XPath to a CSS selector
    if let Some(sel) = xpath_to_css(xpath) {
        if let Ok(selector) = Selector::parse(&sel) {
            let attr = xpath_attr(xpath);
            return html
                .select(&selector)
                .flat_map(|el| {
                    if let Some(a) = &attr {
                        el.value().attr(a).map(|v| v.to_string()).into_iter().collect::<Vec<_>>()
                    } else {
                        vec![el.text().collect::<String>().trim().to_string()]
                    }
                })
                .filter(|s| !s.is_empty())
                .collect();
        }
    }
    vec![]
}

/// 公共版本的 xpath_texts，供其他模块调用
pub fn xpath_texts_pub(html: &Html, xpath: &str) -> Vec<String> {
    xpath_texts(html, xpath)
}

/// 使用 sxd-xpath（kumo xpath feature 的底层）进行原生 XPath 1.0 解析。
/// 支持完整 XPath 表达式：//tag、/@attr、text()、谓词等。
/// 如果 XPath 执行失败，自动降级到基于 CSS 模拟的 xpath_texts。
///
/// html_str: 原始 HTML 字符串
/// xpath: XPath 表达式，如 "//p/text()" 或 "/html/body/div[4]/a/@href"
pub fn xpath_texts_native(html_str: &str, xpath_expr: &str) -> Vec<String> {
    // 尝试用 sxd_html 解析 HTML（自动容错，类似浏览器解析）
    let results = (|| -> Option<Vec<String>> {
        let package = sxd_html::parse_html(html_str);
        let document = package.as_document();
        let value = evaluate_xpath(&document, xpath_expr).ok()?;
        match value {
            sxd_xpath::Value::Nodeset(nodeset) => {
                let items: Vec<String> = nodeset
                    .iter()
                    .map(|node| {
                        node.string_value().trim().to_string()
                    })
                    .filter(|s| !s.is_empty())
                    .collect();
                Some(items)
            }
            sxd_xpath::Value::String(s) => {
                if s.trim().is_empty() { None } else { Some(vec![s.trim().to_string()]) }
            }
            _ => None,
        }
    })();

    match results {
        Some(items) if !items.is_empty() => items,
        _ => {
            // 降级：用原有 CSS 模拟方式
            let html = Html::parse_document(html_str);
            xpath_texts(&html, xpath_expr)
        }
    }
}

/// Extract the attribute name from an XPath like `.../@href`
fn xpath_attr(xpath: &str) -> Option<String> {
    if xpath.ends_with("/@href") { return Some("href".into()); }
    if xpath.ends_with("/@src") { return Some("src".into()); }
    // generic @attr
    if let Some(pos) = xpath.rfind("/@") {
        return Some(xpath[pos + 2..].to_string());
    }
    None
}

/// 剥离 XPath 的 /text() 或 /@attr 尾缀，返回纯元素路径。
fn strip_xpath_suffix(xpath: &str) -> &str {
    // /@attr
    if let Some(pos) = xpath.rfind("/@") {
        return &xpath[..pos];
    }
    // /text()
    if let Some(s) = xpath.strip_suffix("/text()") {
        return s;
    }
    // 裸 text() 后缀（无斜杠）
    if let Some(s) = xpath.strip_suffix("text()") {
        return s.trim_end_matches('/');
    }
    xpath
}

/// 将单个 XPath 路径片段转为 CSS 选择器片段。
/// tag[n] → tag:nth-of-type(n)
fn xpath_part_to_css(part: &str) -> String {
    if let Some(bracket_pos) = part.find('[') {
        let tag = &part[..bracket_pos];
        let idx_str = part[bracket_pos + 1..].trim_end_matches(']');
        if let Ok(idx) = idx_str.parse::<usize>() {
            return format!("{}:nth-of-type({})", tag, idx);
        }
    }
    part.to_string()
}

/// 将配置文件中使用的 XPath 子集转换为 CSS 选择器。
///
/// 支持模式：
///   - 绝对路径    /html/body/div[4]/div/p/text()
///   - 双斜杠     //p/text()   或   /html/body//p/text()
///   - @attr 后缀  /html/body/div/a/@href
///   - tag[n]     → tag:nth-of-type(n)
///
/// CSS 空格 = 后代选择器，对应 //
/// CSS " > " = 直接子代，对应 /
fn xpath_to_css(xpath: &str) -> Option<String> {
    let base = strip_xpath_suffix(xpath);

    if base.is_empty() {
        return None;
    }

    // 如果是纯 //tag（只有一段双斜杠+tag），直接返回 tag
    if base.starts_with("//") && !base[2..].contains('/') {
        let tag = &base[2..];
        if !tag.is_empty() {
            return Some(xpath_part_to_css(tag));
        }
    }

    // 按 // 分割，每段再按 / 处理
    // "/html/body//p" → ["", "/html/body", "p"]  → body > ... p
    // "//p"           → ["", "", "p"]             → "p"
    let mut result_parts: Vec<String> = Vec::new();
    let mut first_seg = true;

    // 用 "//" 分割整个路径
    let double_slash_segs: Vec<&str> = base.split("//").collect();

    for (seg_idx, seg) in double_slash_segs.iter().enumerate() {
        let parts: Vec<&str> = seg.split('/').filter(|s| !s.is_empty()).collect();
        let mut seg_css: Vec<String> = Vec::new();

        for part in &parts {
            if *part == "html" || *part == "body" { continue; }
            seg_css.push(xpath_part_to_css(part));
        }

        if seg_css.is_empty() {
            continue;
        }

        if !first_seg || seg_idx > 0 {
            // 两段 // 之间用空格（后代选择器）连接
            if !result_parts.is_empty() {
                result_parts.push(seg_css.join(" > "));
            } else {
                result_parts.push(seg_css.join(" > "));
            }
        } else {
            result_parts.push(seg_css.join(" > "));
        }
        first_seg = false;
    }

    if result_parts.is_empty() {
        return None;
    }

    // 两个段之间用空格（后代）；同一个段内用 " > "（直接子代）
    Some(result_parts.join(" "))
}

/// Sanitize a filename by removing illegal characters.
pub fn sanitize_filename(name: &str) -> String {
    if name.is_empty() {
        return "Unknown_Novel".to_string();
    }
    let name = name.trim();
    // Remove content in parentheses
    let re_paren = regex::Regex::new(r"\(.*?\)|（.*?）").unwrap();
    let name = re_paren.replace_all(name, "");
    // Remove illegal filename chars
    let re_illegal = regex::Regex::new(r#"[\\/:*?"<>|\n\r\t]"#).unwrap();
    let name = re_illegal.replace_all(&name, "_");
    // Collapse whitespace
    let re_ws = regex::Regex::new(r"\s+").unwrap();
    let name = re_ws.replace_all(&name, " ");
    let name = name.trim().trim_end_matches('.').to_string();
    if name.is_empty() { "Untitled_Novel".to_string() } else { name }
}

/// Scan a single website for candidate novels newer than target_date.
pub async fn scan_site(
    client: &Client,
    site_cfg: &WebsiteConfig,
    net_cfg: &NetworkConfig,
    target_date: &str,
) -> Result<Vec<BookCandidate>> {
    let mut candidates: Vec<BookCandidate> = Vec::new();

    // Fetch all list pages concurrently
    let page_futures: Vec<_> = site_cfg
        .page_list
        .iter()
        .map(|page| {
            let url = format!("{}{}", site_cfg.domain_name, page);
            let client = client.clone();
            let encoding_map = net_cfg.encoding_map.clone();
            let retry_count = net_cfg.retry_count;
            let retry_delay = net_cfg.retry_delay;
            async move {
                fetch_page(&client, &url, &encoding_map, retry_count, retry_delay).await
            }
        })
        .collect();

    let pages = futures::future::join_all(page_futures).await;

    for page_result in pages {
        let html_str = match page_result {
            Ok(s) => s,
            Err(_) => continue,
        };

        let dates = xpath_texts_native(&html_str, &site_cfg.release_date);
        let urls = xpath_texts_native(&html_str, &site_cfg.release_url);
        let names = if !site_cfg.list_novel_name.is_empty() {
            xpath_texts_native(&html_str, &site_cfg.list_novel_name)
        } else {
            vec![]
        };

        let min_len = dates.len().min(urls.len());

        for i in 0..min_len {
            let date = dates[i].trim().to_string();
            if date.as_str() <= target_date {
                continue;
            }

            let raw_url = urls[i].trim().to_string();
            let full_url = if raw_url.starts_with("http") {
                raw_url
            } else {
                format!("{}{}", site_cfg.domain_name, raw_url)
            };

            let name = names.get(i).map(|n| sanitize_filename(n)).unwrap_or_default();

            candidates.push(BookCandidate {
                name,
                url: full_url,
                crawler_domain: site_cfg.domain_name.clone(),
                date,
            });
        }
    }

    Ok(candidates)
}

/// Fetch the novel name from the detail page (fallback when list page has no name).
pub async fn fetch_novel_name(
    client: &Client,
    url: &str,
    novel_name_xpath: &str,
    encoding_map: &HashMap<String, String>,
    retry_count: u32,
    retry_delay: u64,
) -> Option<String> {
    let html_str = fetch_page(client, url, encoding_map, retry_count, retry_delay).await.ok()?;
    let names = xpath_texts_native(&html_str, novel_name_xpath);
    names.into_iter().next().map(|n| sanitize_filename(&n))
}

/// Get chapter URLs from a novel detail page.
pub async fn get_chapter_urls(
    client: &Client,
    novel_url: &str,
    chapter_url_xpath: &str,
    domain: &str,
    encoding_map: &HashMap<String, String>,
    retry_count: u32,
    retry_delay: u64,
) -> Result<Vec<String>> {
    let html_str = fetch_page(client, novel_url, encoding_map, retry_count, retry_delay).await?;
    let raw_urls = xpath_texts_native(&html_str, chapter_url_xpath);

    let urls = raw_urls
        .into_iter()
        .map(|u| {
            if u.starts_with("http") {
                u
            } else {
                format!("{}{}", domain, u)
            }
        })
        .collect();

    Ok(urls)
}

/// Download a single chapter and return its text content.
/// Supports primary xpath + optional fallback list. Tries primary first, then fallbacks in order.
pub async fn download_chapter(
    client: &Client,
    url: &str,
    content_xpath: &str,
    xpath_fallbacks: &[String],
    encoding_map: &HashMap<String, String>,
    retry_count: u32,
    retry_delay: u64,
    filter: &crate::models::ContentFilterConfig,
) -> Result<String> {
    let html_str = fetch_page(client, url, encoding_map, retry_count, retry_delay).await?;
    // Try primary xpath first
    let primary = xpath_texts_native(&html_str, content_xpath);
    if !primary.is_empty() {
        return Ok(optimize_content(primary, filter));
    }

    // Try fallbacks in order
    for fallback_xpath in xpath_fallbacks {
        if fallback_xpath.trim().is_empty() { continue; }
        let parts = xpath_texts_native(&html_str, fallback_xpath.trim());
        if !parts.is_empty() {
            return Ok(optimize_content(parts, filter));
        }
    }

    // Return empty string (all xpaths failed)
    Ok(String::new())
}

/// 去除广告和导航行，带安全回退保护。使用配置中的规则而非硬编码。
fn optimize_content(parts: Vec<String>, filter: &crate::models::ContentFilterConfig) -> String {
    if parts.is_empty() { return String::new(); }

    let cleaned: Vec<String> = parts.into_iter()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    if cleaned.is_empty() { return String::new(); }

    let original_count = cleaned.len();

    let compiled: Vec<Regex> = filter.ad_patterns.iter()
        .filter_map(|p| Regex::new(p).ok())
        .collect();

    let mut filtered: Vec<String> = cleaned.iter()
        .filter(|line| !compiled.iter().any(|re| re.is_match(line)))
        .cloned()
        .collect();

    // 末尾导航行循环剥离
    loop {
        match filtered.last() {
            Some(last) if filter.nav_keywords.iter().any(|kw| last.contains(kw.as_str())) => {
                filtered.pop();
            }
            _ => break,
        }
    }

    // 安全回退：过滤后内容 < 阈值 → 回退到去掉末尾 N 行
    if !filtered.is_empty() && (filtered.len() as f64) < (original_count as f64) * filter.safety_threshold {
        let mut fallback = cleaned;
        let remove_count = fallback.len().min(filter.fallback_trim_lines);
        let new_len = fallback.len() - remove_count;
        fallback.truncate(new_len);
        return fallback.join("\n");
    }

    filtered.join("\n")
}

// ─── Site health check ────────────────────────────────────────────────────────

/// Ping all enabled sites and return reachability + latency.
pub async fn check_site_health(config: &crate::models::AppConfig) -> anyhow::Result<Vec<crate::models::SiteHealth>> {
    let client = build_client(&config.network)?;
    let sites: Vec<_> = config.websites.values()
        .filter(|s| s.enabled)
        .cloned()
        .collect();

    let tasks: Vec<_> = sites.into_iter().map(|site| {
        let client = client.clone();
        tokio::spawn(async move {
            let url = format!("{}/", site.domain_name.trim_end_matches('/'));
            let start = std::time::Instant::now();
            match client.head(&url).send().await {
                Ok(_) => crate::models::SiteHealth {
                    domain: site.domain_name,
                    reachable: true,
                    latency_ms: Some(start.elapsed().as_millis() as u64),
                    error: None,
                },
                Err(e) => crate::models::SiteHealth {
                    domain: site.domain_name,
                    reachable: false,
                    latency_ms: None,
                    error: Some(e.to_string()),
                },
            }
        })
    }).collect();

    let results = futures::future::join_all(tasks).await;
    Ok(results.into_iter().filter_map(|r| r.ok()).collect())
}

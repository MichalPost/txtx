use std::collections::HashMap;
use anyhow::Result;
use backon::{ExponentialBuilder, Retryable};
use reqwest::Client;
use scraper::{Html, Selector};
use encoding_rs::Encoding;
use regex::Regex;
use crate::models::{WebsiteConfig, NetworkConfig, BookCandidate};

/// Build a reqwest client with the given network config.
pub fn build_client(net: &NetworkConfig) -> Result<Client> {
    let mut builder = Client::builder()
        .user_agent(&net.user_agent)
        .timeout(std::time::Duration::from_secs(net.timeout))
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

    let fetch = || async {
        let resp = client.get(url).send().await?;
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

/// Very simplified XPath -> CSS conversion for the patterns used in config.
/// Handles: /html/body/div[n]/... /text() /@attr
fn xpath_to_css(xpath: &str) -> Option<String> {
    // Strip trailing /text() or /@attr
    let base = xpath
        .trim_end_matches(|c: char| c != '/')
        .trim_end_matches('/');
    let base = if base.is_empty() { xpath } else { base };

    // Remove /text() suffix
    let base = base.trim_end_matches("/text()");
    // Remove /@... suffix
    let base = if let Some(pos) = base.rfind("/@") {
        &base[..pos]
    } else {
        base
    };

    // Convert /html/body/div[4]/div/... to CSS
    let parts: Vec<&str> = base.split('/').filter(|s| !s.is_empty()).collect();
    let mut css_parts: Vec<String> = Vec::new();

    for part in &parts {
        if *part == "html" || *part == "body" {
            continue; // skip root elements
        }
        // Handle tag[n] -> tag:nth-of-type(n)
        if let Some(bracket_pos) = part.find('[') {
            let tag = &part[..bracket_pos];
            let idx_str = part[bracket_pos + 1..].trim_end_matches(']');
            if let Ok(idx) = idx_str.parse::<usize>() {
                css_parts.push(format!("{}:nth-of-type({})", tag, idx));
            } else {
                css_parts.push(tag.to_string());
            }
        } else {
            css_parts.push(part.to_string());
        }
    }

    if css_parts.is_empty() {
        return None;
    }

    Some(css_parts.join(" > "))
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

        let html = Html::parse_document(&html_str);

        let dates = xpath_texts(&html, &site_cfg.release_date);
        let urls = xpath_texts(&html, &site_cfg.release_url);
        let names = if !site_cfg.list_novel_name.is_empty() {
            xpath_texts(&html, &site_cfg.list_novel_name)
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
    let html = Html::parse_document(&html_str);
    let names = xpath_texts(&html, novel_name_xpath);
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
    let html = Html::parse_document(&html_str);
    let raw_urls = xpath_texts(&html, chapter_url_xpath);

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
pub async fn download_chapter(
    client: &Client,
    url: &str,
    content_xpath: &str,
    encoding_map: &HashMap<String, String>,
    retry_count: u32,
    retry_delay: u64,
) -> Result<String> {
    let html_str = fetch_page(client, url, encoding_map, retry_count, retry_delay).await?;
    let html = Html::parse_document(&html_str);
    let parts = xpath_texts(&html, content_xpath);
    let text = optimize_content(parts);
    Ok(text)
}

/// Remove ads and navigation lines from chapter content.
fn optimize_content(parts: Vec<String>) -> String {
    let ad_patterns = [
        r"www\.[a-zA-Z0-9.-]+\.(com|cn|net|org)",
        r"QQ[：:]?\s*\d{5,}",
        r"微信[：:]?\s*[a-zA-Z0-9_-]+",
        r"关注.*公众号",
        r"加群.*\d+",
        r"更新.*最快",
        r"手机.*阅读",
        r"上一[篇章][：:]",
        r"下一[篇章][：:]",
        r"返回目录",
        r"章节目录",
        r"书签.*收藏",
        r"加入书架",
    ];

    let compiled: Vec<Regex> = ad_patterns
        .iter()
        .filter_map(|p| Regex::new(p).ok())
        .collect();

    let filtered: Vec<String> = parts
        .into_iter()
        .filter(|line| {
            let line = line.trim();
            if line.is_empty() { return false; }
            !compiled.iter().any(|re| re.is_match(line))
        })
        .collect();

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

pub mod domain_utils;
pub mod filename_utils;
pub mod http_client;
pub mod xpath_parser;
pub(crate) mod content_optimizer;

// Re-export public API so call sites need no changes
pub use domain_utils::extract_domain_pub;
pub use filename_utils::sanitize_filename;
pub use http_client::{build_client, build_client_with_pool, fetch_page};
pub use xpath_parser::{xpath_texts_pub, xpath_texts_native};

use std::collections::HashMap;
use anyhow::Result;
use reqwest::Client;

use crate::models::{
    AppConfig, BookCandidate, ContentFilterConfig, NetworkConfig, SiteHealth, WebsiteConfig,
};
use content_optimizer::optimize_content;
use filename_utils::sanitize_filename as san;
use http_client::fetch_page as fp;
use xpath_parser::xpath_texts_native as xtn;

// ─── scan_site ────────────────────────────────────────────────────────────────

/// Scan a single website for candidate novels newer than target_date.
pub async fn scan_site(
    client: &Client,
    site_cfg: &WebsiteConfig,
    net_cfg: &NetworkConfig,
    target_date: &str,
) -> Result<Vec<BookCandidate>> {
    let mut candidates: Vec<BookCandidate> = Vec::new();

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
                fp(&client, &url, &encoding_map, retry_count, retry_delay).await
            }
        })
        .collect();

    let pages = futures::future::join_all(page_futures).await;

    for page_result in pages {
        let html_str = match page_result {
            Ok(s) => s,
            Err(_) => continue,
        };

        let dates = xtn(&html_str, &site_cfg.release_date);
        let urls  = xtn(&html_str, &site_cfg.release_url);
        let names = if !site_cfg.list_novel_name.is_empty() {
            xtn(&html_str, &site_cfg.list_novel_name)
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

            let name = names.get(i).map(|n| san(n)).unwrap_or_default();

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

// ─── fetch_novel_name ─────────────────────────────────────────────────────────

/// Fetch the novel name from the detail page (fallback when list page has no name).
pub async fn fetch_novel_name(
    client: &Client,
    url: &str,
    novel_name_xpath: &str,
    encoding_map: &HashMap<String, String>,
    retry_count: u32,
    retry_delay: u64,
) -> Option<String> {
    let html_str = fp(client, url, encoding_map, retry_count, retry_delay).await.ok()?;
    let names = xtn(&html_str, novel_name_xpath);
    names.into_iter().next().map(|n| san(&n))
}

// ─── get_chapter_urls ─────────────────────────────────────────────────────────

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
    let html_str = fp(client, novel_url, encoding_map, retry_count, retry_delay).await?;
    let raw_urls = xtn(&html_str, chapter_url_xpath);

    let urls = raw_urls
        .into_iter()
        .map(|u| {
            if u.starts_with("http") { u } else { format!("{}{}", domain, u) }
        })
        .collect();

    Ok(urls)
}

// ─── download_chapter ─────────────────────────────────────────────────────────

/// Download a single chapter and return its text content.
/// Tries primary xpath first, then fallbacks in order.
pub async fn download_chapter(
    client: &Client,
    url: &str,
    content_xpath: &str,
    xpath_fallbacks: &[String],
    encoding_map: &HashMap<String, String>,
    retry_count: u32,
    retry_delay: u64,
    filter: &ContentFilterConfig,
) -> Result<String> {
    let html_str = fp(client, url, encoding_map, retry_count, retry_delay).await?;
    let primary = xtn(&html_str, content_xpath);
    if !primary.is_empty() {
        return Ok(optimize_content(primary, filter));
    }

    for fallback_xpath in xpath_fallbacks {
        if fallback_xpath.trim().is_empty() { continue; }
        let parts = xtn(&html_str, fallback_xpath.trim());
        if !parts.is_empty() {
            return Ok(optimize_content(parts, filter));
        }
    }

    Ok(String::new())
}

// ─── check_site_health ────────────────────────────────────────────────────────

/// Ping all enabled sites and return reachability + latency.
pub async fn check_site_health(config: &AppConfig) -> anyhow::Result<Vec<SiteHealth>> {
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
                Ok(_) => SiteHealth {
                    domain: site.domain_name,
                    reachable: true,
                    latency_ms: Some(start.elapsed().as_millis() as u64),
                    error: None,
                },
                Err(e) => SiteHealth {
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

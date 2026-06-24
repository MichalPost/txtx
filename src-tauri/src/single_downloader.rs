use anyhow::{anyhow, Result};
/// Single novel downloader — given a URL, auto-detect the matching site config
/// and download that one novel.
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::mpsc;

use crate::crawler::{build_client, fetch_novel_name};
use crate::downloader::run_download;
use crate::models::{AppConfig, BookCandidate, ProgressEvent};

/// Find the WebsiteConfig whose domain_name is a prefix of `url`.
fn find_site_for_url<'a>(
    config: &'a AppConfig,
    url: &str,
) -> Option<&'a crate::models::WebsiteConfig> {
    config
        .websites
        .values()
        .find(|s| s.enabled && url.starts_with(&s.domain_name))
}

pub async fn download_single_novel(
    config: AppConfig,
    url: String,
    tx: mpsc::Sender<ProgressEvent>,
    cancel: Arc<tokio::sync::Notify>,
) -> Result<()> {
    let site_cfg = find_site_for_url(&config, &url)
        .ok_or_else(|| anyhow!("未找到匹配的站点配置，URL: {}", url))?
        .clone();

    let _ = tx
        .send(ProgressEvent::Log {
            message: format!("单本下载: {} ({})", url, site_cfg.domain_name),
            level: "info".into(),
        })
        .await;

    let client = Arc::new(build_client(&config.network)?);

    // Fetch novel name from detail page
    let name = fetch_novel_name(
        &client,
        &url,
        &site_cfg.novel_name_x,
        &config.network.encoding_map,
        config.network.retry_count,
        config.network.retry_delay,
    )
    .await
    .unwrap_or_else(|| {
        // Fallback: derive name from URL path
        url.trim_end_matches('/')
            .rsplit('/')
            .next()
            .unwrap_or("unknown")
            .to_string()
    });

    let _ = tx
        .send(ProgressEvent::Log {
            message: format!("书名: {}", name),
            level: "info".into(),
        })
        .await;

    // Build a synthetic AppConfig with only this one novel in the queue.
    // We reuse run_download by injecting a fake "already filtered" queue.
    // Simpler: directly call the internal download logic via a minimal config
    // that has only this site enabled and a target_date far in the past.
    let mut single_config = config.clone();
    // Disable all sites except the matching one
    for (_, s) in single_config.websites.iter_mut() {
        s.enabled = s.domain_name == site_cfg.domain_name;
    }
    // Set target_date to 30 years ago so the novel always passes date filter
    single_config.filtering.last_download_date = Some("1990-01-01".to_string());
    single_config.filtering.days_limit = 365 * 30;

    // Inject the candidate directly via a pre-built queue file
    let base_dir = PathBuf::from(&single_config.paths.base_dir);
    tokio::fs::create_dir_all(&base_dir).await?;

    let candidate = BookCandidate {
        name: name.clone(),
        url: url.clone(),
        crawler_domain: site_cfg.domain_name.clone(),
        date: "".to_string(),
    };

    // Write a queue file so run_download picks it up directly
    let queue = serde_json::json!({
        "created_at": chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        "target_date": "1990-01-01",
        "items": [candidate]
    });
    tokio::fs::write(
        base_dir.join("download_queue.json"),
        serde_json::to_string_pretty(&queue)?.as_bytes(),
    )
    .await?;

    run_download(single_config, tx, cancel).await
}

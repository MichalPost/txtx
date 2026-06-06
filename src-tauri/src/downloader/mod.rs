pub mod queue;
pub mod logger;
pub mod scan_filter;
pub mod novel;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use anyhow::Result;
use chrono::Local;
use serde::{Deserialize, Serialize};
use tokio::sync::{Semaphore, mpsc, Mutex};
use futures::FutureExt;

use crate::models::{AppConfig, BookCandidate, DownloadStats, ProgressEvent, WebsiteConfig};
use crate::crawler::build_client_with_pool;

use self::queue::{load_queue, remove_queue, save_queue, make_queue_snapshot};
use self::logger::{FileLogger, log};
use self::scan_filter::run_scan_and_filter;
use self::novel::download_novel;

// ─── Scan options (overrides from frontend) ───────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScanOptions {
    /// Override target date (YYYY-MM-DD). If None, computed from config.
    pub target_date: Option<String>,
    /// Restrict scan to these site domain_names. If empty, scan all enabled sites.
    pub enabled_sites: Option<Vec<String>>,
}

// ─── Date computation ─────────────────────────────────────────────────────────

fn compute_target_date(cfg: &AppConfig) -> String {
    let f = &cfg.filtering;
    let now = Local::now().date_naive();
    let actual_days = if let Some(last) = &f.last_download_date {
        if let Ok(d) = chrono::NaiveDate::parse_from_str(last, "%Y-%m-%d") {
            (now - d).num_days().max(f.min_days_limit).min(f.days_limit)
        } else {
            f.days_limit
        }
    } else {
        f.days_limit
    };
    (now - chrono::Duration::days(actual_days)).format("%Y-%m-%d").to_string()
}

// ─── Main entry point: full scan + download ───────────────────────────────────

pub async fn run_download(
    config: AppConfig,
    tx: mpsc::Sender<ProgressEvent>,
    cancel: Arc<tokio::sync::Notify>,
) -> Result<()> {
    let client = Arc::new(build_client_with_pool(
        &config.network,
        config.concurrency.max_connections_per_host,
    )?);
    let target_date = compute_target_date(&config);
    let base_dir = PathBuf::from(&config.paths.base_dir);
    let log_dir = PathBuf::from(&config.paths.log_dir);
    tokio::fs::create_dir_all(&base_dir).await?;

    let logger = FileLogger::new(&log_dir).await;

    log(&tx, logger.as_ref(), "info",
        format!("目标日期: {} (下载此日期之后的小说)", target_date)).await;

    // ── Resume from persisted queue if available ──────────────────────────────
    let to_download = if let Some(saved) = load_queue(&base_dir).await {
        if saved.target_date == target_date && !saved.items.is_empty() {
            log(&tx, logger.as_ref(), "info",
                format!("发现未完成的下载队列，恢复 {} 本书", saved.items.len())).await;
            let n = saved.items.len();
            let _ = tx.send(ProgressEvent::FilterDone {
                stats: DownloadStats {
                    total_collected: n, after_dedup: n,
                    blacklist_filtered: 0, local_exists: 0, final_download: n,
                },
            }).await;
            saved.items
        } else {
            remove_queue(&base_dir).await;
            run_scan_and_filter(&config, &client, &target_date, &base_dir,
                &tx, logger.as_ref(), &cancel).await?
        }
    } else {
        run_scan_and_filter(&config, &client, &target_date, &base_dir,
            &tx, logger.as_ref(), &cancel).await?
    };

    if to_download.is_empty() {
        log(&tx, logger.as_ref(), "info", "没有需要下载的新书".into()).await;
        let _ = tx.send(ProgressEvent::OverallDone).await;
        return Ok(());
    }

    // Persist queue before starting
    let _ = save_queue(&base_dir, &make_queue_snapshot(&target_date, to_download.clone())).await;

    // ── Phase 3: Download ─────────────────────────────────────────────────────
    log(&tx, logger.as_ref(), "info",
        format!("第三阶段：开始下载 {} 本...", to_download.len())).await;

    execute_download_batch(
        &config, &client, &base_dir, to_download,
        &target_date, &tx, &logger, &cancel,
    ).await;

    remove_queue(&base_dir).await;
    let _ = crate::config_db::update_last_download_date(
        &std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
        &Local::now().format("%Y-%m-%d").to_string()
    );

    log(&tx, logger.as_ref(), "success", "所有下载任务完成！".into()).await;
    let _ = tx.send(ProgressEvent::OverallDone).await;
    Ok(())
}

// ─── Download pre-selected novels ────────────────────────────────────────────

pub async fn run_download_selected(
    config: AppConfig,
    selected: Vec<BookCandidate>,
    tx: mpsc::Sender<ProgressEvent>,
    cancel: Arc<tokio::sync::Notify>,
) -> Result<()> {
    if selected.is_empty() {
        let _ = tx.send(ProgressEvent::Log {
            message: "没有选中任何书籍".into(), level: "warn".into(),
        }).await;
        let _ = tx.send(ProgressEvent::OverallDone).await;
        return Ok(());
    }

    let client = Arc::new(build_client_with_pool(
        &config.network,
        config.concurrency.max_connections_per_host,
    )?);
    let base_dir = PathBuf::from(&config.paths.base_dir);
    let log_dir = PathBuf::from(&config.paths.log_dir);
    tokio::fs::create_dir_all(&base_dir).await?;

    let logger = FileLogger::new(&log_dir).await;
    let n = selected.len();
    log(&tx, logger.as_ref(), "info", format!("开始下载选中的 {} 本书...", n)).await;

    let _ = tx.send(ProgressEvent::FilterDone {
        stats: DownloadStats {
            total_collected: n, after_dedup: n,
            blacklist_filtered: 0, local_exists: 0, final_download: n,
        },
    }).await;

    let target_date = compute_target_date(&config);
    execute_download_batch(
        &config, &client, &base_dir, selected,
        &target_date, &tx, &logger, &cancel,
    ).await;

    let _ = crate::config_db::update_last_download_date(
        &std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
        &Local::now().format("%Y-%m-%d").to_string()
    );

    log(&tx, logger.as_ref(), "success", "所有下载任务完成！".into()).await;
    let _ = tx.send(ProgressEvent::OverallDone).await;
    Ok(())
}

// ─── Scan only (no download) ──────────────────────────────────────────────────

pub async fn run_scan(
    config: AppConfig,
    tx: mpsc::Sender<ProgressEvent>,
    cancel: Arc<tokio::sync::Notify>,
) -> Result<()> {
    run_scan_with_options(config, ScanOptions::default(), tx, cancel).await
}

pub async fn run_scan_with_options(
    mut config: AppConfig,
    options: ScanOptions,
    tx: mpsc::Sender<ProgressEvent>,
    cancel: Arc<tokio::sync::Notify>,
) -> Result<()> {
    let client = Arc::new(build_client_with_pool(
        &config.network,
        config.concurrency.max_connections_per_host,
    )?);

    // Apply site filter
    if let Some(ref site_filter) = options.enabled_sites {
        if !site_filter.is_empty() {
            for (_, site) in config.websites.iter_mut() {
                if !site_filter.contains(&site.domain_name) {
                    site.enabled = false;
                }
            }
        }
    }

    let target_date = options.target_date
        .unwrap_or_else(|| compute_target_date(&config));
    let base_dir = PathBuf::from(&config.paths.base_dir);

    log(&tx, None, "info",
        format!("目标日期: {} (扫描此日期之后的小说)", target_date)).await;

    let items = scan_filter::build_scan_items(
        &config, &client, &target_date, &base_dir, &tx, &cancel,
    ).await?;

    let stats = DownloadStats {
        total_collected: items.len(),
        after_dedup: items.iter()
            .filter(|i| i.excluded_reason.as_deref() != Some("重复"))
            .count(),
        blacklist_filtered: items.iter()
            .filter(|i| i.excluded_reason.as_deref()
                .map(|r| r.starts_with("黑名单"))
                .unwrap_or(false))
            .count(),
        local_exists: items.iter()
            .filter(|i| i.excluded_reason.as_deref() == Some("本地已存在"))
            .count(),
        final_download: items.iter()
            .filter(|i| i.excluded_reason.is_none())
            .count(),
    };

    let _ = tx.send(ProgressEvent::ScanComplete { items, stats }).await;
    Ok(())
}

// ─── Shared download execution batch ─────────────────────────────────────────

/// 核心并发下载循环，由 run_download 和 run_download_selected 共用。
async fn execute_download_batch(
    config: &AppConfig,
    client: &Arc<reqwest::Client>,
    base_dir: &PathBuf,
    candidates: Vec<BookCandidate>,
    target_date: &str,
    tx: &mpsc::Sender<ProgressEvent>,
    logger: &Option<FileLogger>,
    cancel: &Arc<tokio::sync::Notify>,
) {
    let site_map: HashMap<String, WebsiteConfig> = config.websites.values()
        .map(|s| (s.domain_name.clone(), s.clone()))
        .collect();

    let novel_sem = Arc::new(Semaphore::new(config.concurrency.novel_threads));
    let chapter_sem = Arc::new(Semaphore::new(config.concurrency.chapter_threads));
    let remaining: Arc<Mutex<Vec<BookCandidate>>> =
        Arc::new(Mutex::new(candidates.clone()));

    let mut tasks = Vec::new();

    let content_filter_cfg = config.content_filter.clone();
    let rate_limit_cfg_main = config.rate_limit.clone();

    for candidate in candidates {
        let client = client.clone();
        let site_cfg = match site_map.get(&candidate.crawler_domain) {
            Some(s) => s.clone(),
            None => continue,
        };
        let net_cfg = config.network.clone();
        let base_dir = base_dir.clone();
        let tx = tx.clone();
        let novel_sem = novel_sem.clone();
        let chapter_sem = chapter_sem.clone();
        let cancel = cancel.clone();
        let remaining = remaining.clone();
        let logger_file = logger.as_ref().map(|l| l.file.clone());
        let text_conv = config.text_conversion.clone();
        let ebook_conv = config.ebook_conversion.clone();
        let content_filter_cfg = content_filter_cfg.clone();
        let rate_limit_cfg_clone = rate_limit_cfg_main.clone();
        let target_date = target_date.to_string();

        tasks.push(tokio::spawn(async move {
            let _permit = novel_sem.acquire().await.unwrap();
            if cancel.notified().now_or_never().is_some() { return; }

            let name = candidate.name.clone();
            let domain = candidate.crawler_domain.clone();

            let _ = tx.send(ProgressEvent::NovelStart {
                novel: name.clone(), site: domain.clone(),
            }).await;

            let result = download_novel(
                &client, &candidate, &site_cfg, &net_cfg,
                &base_dir, chapter_sem, cancel,
                tx.clone(), text_conv, ebook_conv,
                content_filter_cfg.clone(), rate_limit_cfg_clone.clone(),
            ).await;

            // Log result to file
            if let Some(f) = &logger_file {
                use tokio::io::AsyncWriteExt;
                let (lvl, msg) = match &result {
                    Ok(_) => ("SUCCESS", format!("✓ {} 下载完成", name)),
                    Err(e) => ("ERROR", format!("✗ {} 失败: {}", name, e)),
                };
                let line = format!("[{}] [{}] {}\n",
                    Local::now().format("%Y-%m-%d %H:%M:%S"), lvl, msg);
                let _ = f.lock().await.write_all(line.as_bytes()).await;
            }

            match result {
                Ok(_) => {
                    let _ = tx.send(ProgressEvent::Log {
                        message: format!("✓ {} 下载完成", name),
                        level: "success".into(),
                    }).await;
                    let _ = tx.send(ProgressEvent::NovelDone {
                        novel: name.clone(), site: domain,
                    }).await;
                }
                Err(e) => {
                    let _ = tx.send(ProgressEvent::NovelError {
                        novel: name.clone(), site: domain,
                        message: e.to_string(),
                    }).await;
                }
            }

            // Update persisted queue snapshot
            let mut rem = remaining.lock().await;
            rem.retain(|c| c.name != name);
            let snapshot = make_queue_snapshot(&target_date, rem.clone());
            drop(rem);
            let _ = save_queue(&base_dir, &snapshot).await;
        }));
    }

    futures::future::join_all(tasks).await;
}

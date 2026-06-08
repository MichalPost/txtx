use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use chrono::Local;
use tokio::sync::{Semaphore, mpsc, Mutex};
use futures::FutureExt;

use crate::models::{AppConfig, BookCandidate, ProgressEvent, WebsiteConfig};

use super::queue::{save_queue, make_queue_snapshot};
use super::logger::FileLogger;
use super::novel::download_novel;

// ─── Date computation ─────────────────────────────────────────────────────────

pub(super) fn compute_target_date(cfg: &AppConfig) -> String {
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

fn normalize_worker_count(value: usize) -> usize {
    value.max(1)
}

// ─── Shared download execution batch ─────────────────────────────────────────

/// 核心并发下载循环，由 run_download 和 run_download_selected 共用。
pub(super) async fn execute_download_batch(
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

    let novel_sem = Arc::new(Semaphore::new(normalize_worker_count(config.concurrency.novel_threads)));
    let chapter_sem = Arc::new(Semaphore::new(normalize_worker_count(config.concurrency.chapter_threads)));
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
            let url = candidate.url.clone();

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
                        novel: name.clone(), site: domain, url,
                    }).await;
                }
                Err(e) => {
                    let _ = tx.send(ProgressEvent::NovelError {
                        novel: name.clone(), site: domain, url,
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

#[cfg(test)]
mod tests {
    use super::normalize_worker_count;

    #[test]
    fn normalize_worker_count_prevents_zero_permit_deadlock() {
        assert_eq!(normalize_worker_count(0), 1);
        assert_eq!(normalize_worker_count(3), 3);
    }
}

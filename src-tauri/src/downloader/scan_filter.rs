use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use anyhow::Result;
use tokio::sync::{Semaphore, mpsc};
use futures::FutureExt;

use crate::models::{AppConfig, BookCandidate, DownloadStats, ProgressEvent, ScanItem, WebsiteConfig};
use crate::crawler::{fetch_novel_name, scan_site};
use crate::blacklist::Blacklist;
use super::logger::{FileLogger, log};

// ─── Scan + filter (returns download list) ────────────────────────────────────

pub async fn run_scan_and_filter(
    config: &AppConfig,
    client: &Arc<reqwest::Client>,
    target_date: &str,
    base_dir: &Path,
    tx: &mpsc::Sender<ProgressEvent>,
    logger: Option<&FileLogger>,
    cancel: &Arc<tokio::sync::Notify>,
) -> Result<Vec<BookCandidate>> {
    log(tx, logger, "info", "第一阶段：扫描站点...".into()).await;

    let enabled_sites: Vec<WebsiteConfig> = config.websites.values()
        .filter(|s| s.enabled).cloned().collect();

    if cancel.notified().now_or_never().is_some() {
        return Ok(vec![]);
    }
    log(tx, logger, "info", format!("并发扫描 {} 个站点...", enabled_sites.len())).await;

    let all_candidates: Vec<BookCandidate> = match crate::kumo_scanner::scan_all_sites_concurrent(
        enabled_sites.clone(),
        &config.network,
        target_date,
    ).await {
        Ok(candidates) => {
            log(tx, logger, "info",
                format!("并发扫描完成，共 {} 条候选", candidates.len())).await;
            for site_cfg in &enabled_sites {
                let count = candidates.iter()
                    .filter(|c| c.crawler_domain == site_cfg.domain_name)
                    .count();
                let _ = tx.send(ProgressEvent::ScanDone {
                    site: site_cfg.domain_name.clone(), total: count,
                }).await;
            }
            candidates
        }
        Err(e) => {
            log(tx, logger, "warn",
                format!("并发扫描失败: {}，回退到串行扫描", e)).await;
            serial_scan_fallback(config, client, target_date, tx, logger, cancel).await?
        }
    };

    apply_filter(config, base_dir, all_candidates, tx, logger).await
}

/// 串行扫描降级路径
async fn serial_scan_fallback(
    config: &AppConfig,
    client: &Arc<reqwest::Client>,
    target_date: &str,
    tx: &mpsc::Sender<ProgressEvent>,
    logger: Option<&FileLogger>,
    cancel: &Arc<tokio::sync::Notify>,
) -> Result<Vec<BookCandidate>> {
    let enabled_sites: Vec<WebsiteConfig> = config.websites.values()
        .filter(|s| s.enabled).cloned().collect();

    let mut fallback: Vec<BookCandidate> = Vec::new();
    for site_cfg in &enabled_sites {
        if cancel.notified().now_or_never().is_some() {
            return Ok(vec![]);
        }
        let _ = tx.send(ProgressEvent::ScanStart {
            site: site_cfg.domain_name.clone(),
        }).await;
        match scan_site(client, site_cfg, &config.network, target_date).await {
            Ok(mut candidates) => {
                fill_missing_names(client, site_cfg, config, &mut candidates).await;
                let valid: Vec<_> = candidates.into_iter().filter(|c| !c.name.is_empty()).collect();
                let count = valid.len();
                let _ = tx.send(ProgressEvent::ScanDone {
                    site: site_cfg.domain_name.clone(), total: count,
                }).await;
                log(tx, logger, "info",
                    format!("{}: 扫描到 {} 本", site_cfg.domain_name, count)).await;
                fallback.extend(valid);
            }
            Err(e) => {
                log(tx, logger, "error",
                    format!("{}: 扫描失败 - {}", site_cfg.domain_name, e)).await;
            }
        }
    }
    Ok(fallback)
}

/// 并发补全缺失书名
async fn fill_missing_names(
    client: &Arc<reqwest::Client>,
    site_cfg: &WebsiteConfig,
    config: &AppConfig,
    candidates: &mut Vec<BookCandidate>,
) {
    let sem = Arc::new(Semaphore::new(config.concurrency.novel_threads.min(3)));
    let fill_tasks: Vec<_> = candidates.iter()
        .filter(|c| c.name.is_empty())
        .map(|c| {
            let client = client.clone();
            let url = c.url.clone();
            let xpath = site_cfg.novel_name_x.clone();
            let enc = config.network.encoding_map.clone();
            let rc = config.network.retry_count;
            let rd = config.network.retry_delay;
            let sem = sem.clone();
            tokio::spawn(async move {
                let _p = sem.acquire().await.unwrap();
                let name = fetch_novel_name(&client, &url, &xpath, &enc, rc, rd).await;
                (url, name)
            })
        })
        .collect();

    let name_map: HashMap<String, String> = futures::future::join_all(fill_tasks).await
        .into_iter()
        .filter_map(|r| r.ok())
        .filter_map(|(url, name)| name.map(|n| (url, n)))
        .collect();

    for c in candidates.iter_mut() {
        if c.name.is_empty() {
            if let Some(n) = name_map.get(&c.url) {
                c.name = n.clone();
            }
        }
    }
}

/// 去重 + 黑名单 + 本地存在过滤，返回最终待下载列表并发送 FilterDone 事件
async fn apply_filter(
    config: &AppConfig,
    base_dir: &Path,
    all_candidates: Vec<BookCandidate>,
    tx: &mpsc::Sender<ProgressEvent>,
    logger: Option<&FileLogger>,
) -> Result<Vec<BookCandidate>> {
    log(tx, logger, "info", "第二阶段：去重和筛选...".into()).await;

    let total_collected = all_candidates.len();

    // Dedup by name, prefer higher-priority site
    let priority_map = &config.filtering.site_priority;
    let mut name_map: HashMap<String, BookCandidate> = HashMap::new();
    for c in all_candidates {
        let cur_pri = priority_map.get(&c.crawler_domain).copied().unwrap_or(999);
        let entry = name_map.entry(c.name.clone()).or_insert_with(|| c.clone());
        let exist_pri = priority_map.get(&entry.crawler_domain).copied().unwrap_or(999);
        if cur_pri < exist_pri { *entry = c; }
    }
    let deduped: Vec<BookCandidate> = name_map.into_values().collect();
    let after_dedup = deduped.len();

    // Blacklist
    let blacklist = Blacklist::new(&config.blacklist);
    let mut blacklist_filtered = 0usize;
    let after_blacklist: Vec<BookCandidate> = if config.blacklist.enabled {
        deduped.into_iter().filter(|c| {
            let (blocked, reason) = blacklist.is_blocked(&c.name);
            if blocked {
                blacklist_filtered += 1;
                let _ = tx.try_send(ProgressEvent::Log {
                    message: format!("黑名单过滤: {} ({})", c.name, reason),
                    level: "info".into(),
                });
            }
            !blocked
        }).collect()
    } else {
        deduped
    };

    // Local exists
    let mut local_exists = 0usize;
    let to_download: Vec<BookCandidate> = after_blacklist.into_iter().filter(|c| {
        if base_dir.join(format!("{}.txt", c.name)).exists() {
            local_exists += 1;
            false
        } else {
            true
        }
    }).collect();

    let final_download = to_download.len();
    let _ = tx.send(ProgressEvent::FilterDone {
        stats: DownloadStats {
            total_collected, after_dedup, blacklist_filtered, local_exists, final_download,
        },
    }).await;
    log(tx, logger, "info", format!(
        "筛选完成：收集 {} → 去重 {} → 黑名单 {} → 已有 {} → 待下载 {}",
        total_collected, after_dedup, blacklist_filtered, local_exists, final_download
    )).await;

    Ok(to_download)
}

// ─── Build annotated ScanItem list (for scan-only mode) ──────────────────────

pub async fn build_scan_items(
    config: &AppConfig,
    client: &Arc<reqwest::Client>,
    target_date: &str,
    base_dir: &Path,
    _tx: &mpsc::Sender<ProgressEvent>,
    cancel: &Arc<tokio::sync::Notify>,
) -> Result<Vec<ScanItem>> {
    let enabled_sites: Vec<WebsiteConfig> = config.websites.values()
        .filter(|s| s.enabled).cloned().collect();

    let mut all_candidates: Vec<BookCandidate> = Vec::new();

    match crate::kumo_scanner::scan_all_sites_concurrent(
        enabled_sites.clone(),
        &config.network,
        target_date,
    ).await {
        Ok(candidates) => {
            all_candidates.extend(candidates);
        }
        Err(_) => {
            // 降级：串行逐站扫描
            for site_cfg in &enabled_sites {
                if cancel.notified().now_or_never().is_some() {
                    return Ok(vec![]);
                }
                if let Ok(mut candidates) =
                    crate::crawler::scan_site(client, site_cfg, &config.network, target_date).await
                {
                    fill_missing_names(client, site_cfg, config, &mut candidates).await;
                    all_candidates.extend(candidates.into_iter().filter(|c| !c.name.is_empty()));
                }
            }
        }
    }

    let total_collected = all_candidates.len();
    let mut items: Vec<ScanItem> = Vec::with_capacity(total_collected);

    // Dedup pass (track which names are duplicated)
    let priority_map = &config.filtering.site_priority;
    let mut name_map: HashMap<String, BookCandidate> = HashMap::new();
    let mut dup_names: std::collections::HashSet<String> = std::collections::HashSet::new();

    for c in &all_candidates {
        let cur_pri = priority_map.get(&c.crawler_domain).copied().unwrap_or(999);
        let entry = name_map.entry(c.name.clone()).or_insert_with(|| c.clone());
        let exist_pri = priority_map.get(&entry.crawler_domain).copied().unwrap_or(999);
        if cur_pri < exist_pri {
            dup_names.insert(entry.name.clone());
            *entry = c.clone();
        } else if entry.url != c.url {
            dup_names.insert(c.name.clone());
        }
    }

    let blacklist = Blacklist::new(&config.blacklist);

    for c in all_candidates {
        // A candidate is a duplicate if its name has duplicates AND it is not the
        // winner kept in name_map (i.e. its URL differs from the winning entry).
        let is_dup = dup_names.contains(&c.name)
            && name_map.get(&c.name).map(|winner| winner.url != c.url).unwrap_or(true);

        let excluded_reason = if is_dup {
            Some("重复".to_string())
        } else if config.blacklist.enabled {
            let (blocked, reason) = blacklist.is_blocked(&c.name);
            if blocked { Some(format!("黑名单: {}", reason)) } else { None }
        } else {
            None
        };

        let excluded_reason = excluded_reason.or_else(|| {
            if base_dir.join(format!("{}.txt", c.name)).exists() {
                Some("本地已存在".to_string())
            } else {
                None
            }
        });

        items.push(ScanItem {
            name: c.name,
            url: c.url,
            site: c.crawler_domain,
            date: c.date,
            excluded_reason,
        });
    }

    Ok(items)
}

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use anyhow::Result;
use backon::{ExponentialBuilder, Retryable};
use tokio::sync::{Semaphore, mpsc, Mutex};
use chrono::Local;
use futures::FutureExt;
use serde::{Deserialize, Serialize};

use crate::models::{
    AppConfig, BookCandidate, DownloadStats, EbookConversionConfig,
    ProgressEvent, ScanItem, TextConversionConfig, WebsiteConfig, NetworkConfig,
};
use crate::crawler::{build_client_with_pool, scan_site, fetch_novel_name, get_chapter_urls, download_chapter};
use crate::blacklist::Blacklist;
use crate::text_converter;
use crate::ebook_converter;

// ─── Queue persistence ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DownloadQueue {
    created_at: String,
    target_date: String,
    items: Vec<BookCandidate>,
}

async fn save_queue(base_dir: &Path, queue: &DownloadQueue) -> Result<()> {
    let path = base_dir.join("download_queue.json");
    let json = serde_json::to_string_pretty(queue)?;
    tokio::fs::write(&path, json.as_bytes()).await?;
    Ok(())
}

async fn load_queue(base_dir: &Path) -> Option<DownloadQueue> {
    let path = base_dir.join("download_queue.json");
    let data = tokio::fs::read_to_string(&path).await.ok()?;
    serde_json::from_str(&data).ok()
}

async fn remove_queue(base_dir: &Path) {
    let _ = tokio::fs::remove_file(base_dir.join("download_queue.json")).await;
}

// ─── Log file output ──────────────────────────────────────────────────────────

struct FileLogger {
    file: Arc<Mutex<tokio::fs::File>>,
}

impl FileLogger {
    async fn new(log_dir: &Path) -> Option<Self> {
        tokio::fs::create_dir_all(log_dir).await.ok()?;
        let filename = Local::now().format("download_%Y%m%d_%H%M%S.log").to_string();
        let file = tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_dir.join(filename))
            .await
            .ok()?;
        Some(Self { file: Arc::new(Mutex::new(file)) })
    }

    async fn write(&self, level: &str, message: &str) {
        use tokio::io::AsyncWriteExt;
        let line = format!(
            "[{}] [{}] {}\n",
            Local::now().format("%Y-%m-%d %H:%M:%S"),
            level.to_uppercase(),
            message
        );
        let _ = self.file.lock().await.write_all(line.as_bytes()).await;
    }
}

// ─── Helper: send log event + write to file ───────────────────────────────────

async fn log(
    tx: &mpsc::Sender<ProgressEvent>,
    logger: Option<&FileLogger>,
    level: &str,
    message: String,
) {
    if let Some(l) = logger { l.write(level, &message).await; }
    let _ = tx.send(ProgressEvent::Log { message, level: level.into() }).await;
}

// ─── Date computation ─────────────────────────────────────────────────────────

fn compute_target_date(cfg: &AppConfig) -> String {
    let f = &cfg.filtering;
    let now = Local::now().date_naive();
    let actual_days = if let Some(last) = &f.last_download_date {
        if let Ok(d) = chrono::NaiveDate::parse_from_str(last, "%Y-%m-%d") {
            (now - d).num_days().max(f.min_days_limit).min(f.days_limit)
        } else { f.days_limit }
    } else { f.days_limit };
    (now - chrono::Duration::days(actual_days)).format("%Y-%m-%d").to_string()
}

// ─── Main entry point ─────────────────────────────────────────────────────────

pub async fn run_download(
    config: AppConfig,
    tx: mpsc::Sender<ProgressEvent>,
    cancel: Arc<tokio::sync::Notify>,
) -> Result<()> {
    let client = Arc::new(build_client_with_pool(&config.network, config.concurrency.max_connections_per_host)?);
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
            // Re-emit a synthetic FilterDone so the UI shows stats
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
    let _ = save_queue(&base_dir, &DownloadQueue {
        created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        target_date: target_date.clone(),
        items: to_download.clone(),
    }).await;

    // ── Phase 3: Download ─────────────────────────────────────────────────────
    log(&tx, logger.as_ref(), "info",
        format!("第三阶段：开始下载 {} 本...", to_download.len())).await;

    let site_map: HashMap<String, WebsiteConfig> = config.websites.values()
        .map(|s| (s.domain_name.clone(), s.clone())).collect();

    let novel_sem = Arc::new(Semaphore::new(config.concurrency.novel_threads));
    let chapter_sem = Arc::new(Semaphore::new(config.concurrency.chapter_threads));
    let remaining: Arc<Mutex<Vec<BookCandidate>>> = Arc::new(Mutex::new(to_download.clone()));

    let mut tasks = Vec::new();

    let content_filter_cfg = config.content_filter.clone();
    let ttks_cfg_main = config.ttks.clone();

    for candidate in to_download {
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
        let ttks_cfg_clone = ttks_cfg_main.clone();
        let target_date = target_date.clone();

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
                content_filter_cfg.clone(), ttks_cfg_clone.clone(),
            ).await;

            // Log to file
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

            // Update persisted queue
            let mut rem = remaining.lock().await;
            rem.retain(|c| c.name != name);
            let snapshot = DownloadQueue {
                created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                target_date,
                items: rem.clone(),
            };
            drop(rem);
            let _ = save_queue(&base_dir, &snapshot).await;
        }));
    }

    futures::future::join_all(tasks).await;

    remove_queue(&base_dir).await;
    let _ = crate::config::update_last_download_date(
        &Local::now().format("%Y-%m-%d").to_string()
    );

    log(&tx, logger.as_ref(), "success", "所有下载任务完成！".into()).await;
    let _ = tx.send(ProgressEvent::OverallDone).await;
    Ok(())
}

// ─── Scan + filter ────────────────────────────────────────────────────────────

async fn run_scan_and_filter(
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

    // 并发扫描所有站点（kumo multi-spider）
    if cancel.notified().now_or_never().is_some() { return Ok(vec![]); }
    log(tx, logger, "info", format!("并发扫描 {} 个站点...", enabled_sites.len())).await;

    let all_candidates: Vec<BookCandidate> = match crate::kumo_scanner::scan_all_sites_concurrent(
        enabled_sites.clone(),
        &config.network,
        target_date,
    ).await {
        Ok(candidates) => {
            log(tx, logger, "info",
                format!("并发扫描完成，共 {} 条候选", candidates.len())).await;
            // 发送每个站点的 ScanDone 汇总事件
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
            // 降级：串行扫描（保留原始逻辑）
            let mut fallback: Vec<BookCandidate> = Vec::new();
            for site_cfg in &enabled_sites {
                if cancel.notified().now_or_never().is_some() { return Ok(vec![]); }
                let _ = tx.send(ProgressEvent::ScanStart { site: site_cfg.domain_name.clone() }).await;
                match scan_site(client, site_cfg, &config.network, target_date).await {
                    Ok(mut candidates) => {
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
                            }).collect();
                        let name_map: HashMap<String, String> = futures::future::join_all(fill_tasks).await
                            .into_iter().filter_map(|r| r.ok())
                            .filter_map(|(url, name)| name.map(|n| (url, n)))
                            .collect();
                        for c in candidates.iter_mut() {
                            if c.name.is_empty() {
                                if let Some(n) = name_map.get(&c.url) { c.name = n.clone(); }
                            }
                        }
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
            fallback
        }
    };

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
    } else { deduped };

    // Local exists
    let mut local_exists = 0usize;
    let to_download: Vec<BookCandidate> = after_blacklist.into_iter().filter(|c| {
        if base_dir.join(format!("{}.txt", c.name)).exists() {
            local_exists += 1; false
        } else { true }
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

// ─── Download a single novel ──────────────────────────────────────────────────

async fn download_novel(
    client: &reqwest::Client,
    candidate: &BookCandidate,
    site_cfg: &WebsiteConfig,
    net_cfg: &NetworkConfig,
    base_dir: &Path,
    chapter_sem: Arc<Semaphore>,
    cancel: Arc<tokio::sync::Notify>,
    tx: mpsc::Sender<ProgressEvent>,
    text_conv: TextConversionConfig,
    ebook_conv: EbookConversionConfig,
    cfg_content_filter: crate::models::ContentFilterConfig,
    cfg_ttks: crate::models::TtksConfig,
) -> Result<()> {
    let chapter_urls = get_chapter_urls(
        client, &candidate.url, &site_cfg.chapter_url_x,
        &site_cfg.domain_name, &net_cfg.encoding_map,
        net_cfg.retry_count, net_cfg.retry_delay,
    ).await?;

    if chapter_urls.is_empty() {
        return Err(anyhow::anyhow!("没有找到章节链接"));
    }

    let total_chapters = chapter_urls.len();
    let content_filter = cfg_content_filter.clone();
    let ttks_cfg = cfg_ttks.clone();
    let xpath_fallbacks = site_cfg.novel_content_fallbacks.clone();
    let temp_dir = base_dir.join(format!("temp_{}", candidate.name));
    tokio::fs::create_dir_all(&temp_dir).await?;

    let counter = Arc::new(std::sync::atomic::AtomicUsize::new(0));

    // ── First pass ────────────────────────────────────────────────────────────
    let first_pass: Vec<_> = chapter_urls.iter().enumerate().map(|(idx, url)| {
        let client = client.clone();
        let url = url.clone();
        let xpath = site_cfg.novel_content.clone();
        let enc = net_cfg.encoding_map.clone();
        let rc = net_cfg.retry_count;
        let rd = net_cfg.retry_delay;
        let proxy = net_cfg.proxy.clone();
        let timeout = net_cfg.timeout;
        let temp_dir = temp_dir.clone();
        let sem = chapter_sem.clone();
        let cancel = cancel.clone();
        let tx = tx.clone();
        let novel = candidate.name.clone();
        let ctr = counter.clone();
        let tc = text_conv.clone();
        let ttks_cfg = ttks_cfg.clone();
        let content_filter = content_filter.clone();
        let xpath_fallbacks = xpath_fallbacks.clone();

        tokio::spawn(async move {
            let _p = sem.acquire().await.unwrap();
            if cancel.notified().now_or_never().is_some() {
                return Ok::<_, anyhow::Error>(());
            }

            let temp_file = temp_dir.join(format!("{:04}.txt", idx));

            // Resume: skip already-good files
            if temp_file.exists() {
                if let Ok(m) = tokio::fs::metadata(&temp_file).await {
                    if m.len() >= 1024 {
                        let done = ctr.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
                        let _ = tx.send(ProgressEvent::ChapterDone {
                            novel, current: done, total: total_chapters,
                        }).await;
                        return Ok(());
                    }
                }
            }

            // TTKS 专用下载器 vs 通用下载器
            let text = if crate::ttks_downloader::is_ttks_url(&url, &ttks_cfg) {
                let proxy_opt = proxy.as_deref().filter(|p| !p.is_empty());
                match crate::ttks_downloader::build_ttks_client(proxy_opt, timeout, &ttks_cfg) {
                    Ok(ttks_client) => {
                        let domain = url.split('/').take(3).collect::<Vec<_>>().join("/");
                        crate::ttks_downloader::fetch_ttks_chapter(
                            &ttks_client, &url, &domain,
                            &xpath, &xpath_fallbacks, &enc, rc, rd, &ttks_cfg, &content_filter,
                        ).await?
                    }
                    Err(_) => {
                        // 构建专用客户端失败，回退到通用
                        download_chapter(&client, &url, &xpath, &xpath_fallbacks, &enc, rc, rd, &content_filter).await?
                    }
                }
            } else {
                download_chapter(&client, &url, &xpath, &xpath_fallbacks, &enc, rc, rd, &content_filter).await?
            };
            if !text.is_empty() {
                let out = if tc.enabled && tc.traditional_to_simplified {
                    text_converter::detect_and_convert(&text, tc.auto_detect).0
                } else { text };
                tokio::fs::write(&temp_file, out.as_bytes()).await?;
            }

            let done = ctr.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
            let _ = tx.send(ProgressEvent::ChapterDone {
                novel, current: done, total: total_chapters,
            }).await;
            Ok(())
        })
    }).collect();

    let first_results = futures::future::join_all(first_pass).await;
    let failed_indices: Vec<usize> = first_results.iter().enumerate()
        .filter(|(_, r)| r.as_ref().map(|i| i.is_err()).unwrap_or(true))
        .map(|(i, _)| i).collect();

    // ── Repair pass ───────────────────────────────────────────────────────────
    let mut small_indices: Vec<usize> = Vec::new();
    for idx in 0..total_chapters {
        let f = temp_dir.join(format!("{:04}.txt", idx));
        if f.exists() {
            if let Ok(m) = tokio::fs::metadata(&f).await {
                if m.len() < 1024 { small_indices.push(idx); }
            }
        }
    }

    let mut repair_set: Vec<usize> = failed_indices.clone();
    for i in &small_indices { if !repair_set.contains(i) { repair_set.push(*i); } }
    repair_set.sort_unstable();

    if !repair_set.is_empty() {
        let _ = tx.send(ProgressEvent::Log {
            message: format!("{}: 修复 {} 个问题章节...", candidate.name, repair_set.len()),
            level: "warn".into(),
        }).await;

        let repair_sem = Arc::new(Semaphore::new(3));
        let repair_tasks: Vec<_> = repair_set.iter().map(|&idx| {
            let client = client.clone();
            let url = chapter_urls[idx].clone();
            let xpath = site_cfg.novel_content.clone();
            let enc = net_cfg.encoding_map.clone();
            let rc = net_cfg.retry_count;
            let rd = net_cfg.retry_delay;
            let temp_dir = temp_dir.clone();
            let sem = repair_sem.clone();

            tokio::spawn(async move {
                let _p = sem.acquire().await.unwrap();
                let result = (|| async {
                    let text = download_chapter(&client, &url, &xpath, &[], &enc, rc, rd, &crate::models::ContentFilterConfig::default()).await?;
                    if text.is_empty() {
                        return Err(anyhow::anyhow!("empty chapter"));
                    }
                    let f = temp_dir.join(format!("{:04}.txt", idx));
                    tokio::fs::write(&f, text.as_bytes()).await?;
                    Ok::<_, anyhow::Error>(())
                })
                .retry(
                    ExponentialBuilder::default()
                        .with_max_times(3)
                        .with_min_delay(std::time::Duration::from_secs(2)),
                )
                .await;
                (idx, result.is_ok())
            })
        }).collect();

        let repair_results = futures::future::join_all(repair_tasks).await;
        let still_failed: Vec<usize> = repair_results.into_iter()
            .filter_map(|r| r.ok())
            .filter(|(_, ok)| !ok)
            .map(|(i, _)| i).collect();

        if !still_failed.is_empty() {
            let _ = tx.send(ProgressEvent::Log {
                message: format!("{}: {} 个章节修复失败，将跳过",
                    candidate.name, still_failed.len()),
                level: "warn".into(),
            }).await;
        }

        let threshold = (total_chapters as f64 * 0.05).max(2.0) as usize;
        if still_failed.len() > threshold {
            return Err(anyhow::anyhow!(
                "章节下载失败过多: {}/{} (修复后仍失败)",
                still_failed.len(), total_chapters
            ));
        }
    } else {
        let threshold = (total_chapters as f64 * 0.05).max(2.0) as usize;
        if failed_indices.len() > threshold {
            return Err(anyhow::anyhow!(
                "章节下载失败过多: {}/{}", failed_indices.len(), total_chapters
            ));
        }
    }

    // ── Merge ─────────────────────────────────────────────────────────────────
    let final_path = base_dir.join(format!("{}.txt", candidate.name));
    merge_chapters(&temp_dir, &final_path, total_chapters).await?;
    let _ = tokio::fs::remove_dir_all(&temp_dir).await;

    // ── Ebook conversion ──────────────────────────────────────────────────────
    if ebook_conv.enabled && !ebook_conv.formats.is_empty() {
        for fmt in &ebook_conv.formats {
            let calibre = ebook_conv.calibre_path.as_ref().map(PathBuf::from);
            match ebook_converter::convert(final_path.clone(), fmt, calibre).await {
                Ok(out) => {
                    let _ = tx.send(ProgressEvent::Log {
                        message: format!("电子书转换完成: {}", out.display()),
                        level: "info".into(),
                    }).await;
                }
                Err(e) => {
                    let _ = tx.send(ProgressEvent::Log {
                        message: format!("电子书转换失败 ({}): {}", fmt, e),
                        level: "warn".into(),
                    }).await;
                }
            }
        }
    }

    Ok(())
}

// ─── Merge helper ─────────────────────────────────────────────────────────────

async fn merge_chapters(temp_dir: &Path, final_path: &Path, total: usize) -> Result<()> {
    use tokio::io::AsyncWriteExt;
    let mut file = tokio::fs::File::create(final_path).await?;
    for i in 0..total {
        let f = temp_dir.join(format!("{:04}.txt", i));
        if f.exists() {
            let content = tokio::fs::read_to_string(&f).await.unwrap_or_default();
            if !content.is_empty() {
                file.write_all(content.as_bytes()).await?;
                file.write_all(b"\n").await?;
            }
        }
    }
    file.flush().await?;
    Ok(())
}

// ─── Scan options (overrides from frontend) ───────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScanOptions {
    /// Override target date (YYYY-MM-DD). If None, computed from config.
    pub target_date: Option<String>,
    /// Restrict scan to these site domain_names. If empty, scan all enabled sites.
    pub enabled_sites: Option<Vec<String>>,
}

// ─── Public: scan only (no download) ─────────────────────────────────────────

/// Scan all enabled sites, apply dedup + blacklist + local-exists filter,
/// and emit a single `ScanComplete` event with the full annotated list.
pub async fn run_scan(
    config: AppConfig,
    tx: mpsc::Sender<ProgressEvent>,
    cancel: Arc<tokio::sync::Notify>,
) -> Result<()> {
    run_scan_with_options(config, ScanOptions::default(), tx, cancel).await
}

/// Scan with explicit options (target_date override, site filter).
pub async fn run_scan_with_options(
    mut config: AppConfig,
    options: ScanOptions,
    tx: mpsc::Sender<ProgressEvent>,
    cancel: Arc<tokio::sync::Notify>,
) -> Result<()> {
    let client = Arc::new(build_client_with_pool(&config.network, config.concurrency.max_connections_per_host)?);

    // Apply site filter: disable sites not in the list
    if let Some(ref site_filter) = options.enabled_sites {
        if !site_filter.is_empty() {
            for (_, site) in config.websites.iter_mut() {
                if !site_filter.contains(&site.domain_name) {
                    site.enabled = false;
                }
            }
        }
    }

    let target_date = if let Some(ref d) = options.target_date {
        d.clone()
    } else {
        compute_target_date(&config)
    };
    let base_dir = PathBuf::from(&config.paths.base_dir);

    log(&tx, None, "info",
        format!("目标日期: {} (扫描此日期之后的小说)", target_date)).await;

    // Build the full annotated list (scan + dedup + blacklist + local-exists)
    let items = build_scan_items(&config, &client, &target_date, &base_dir, &tx, &cancel).await?;

    let stats = crate::models::DownloadStats {
        total_collected: items.len(),
        after_dedup: items.iter().filter(|i| i.excluded_reason.as_deref() != Some("重复")).count(),
        blacklist_filtered: items.iter().filter(|i| i.excluded_reason.as_deref().map(|r| r.starts_with("黑名单")).unwrap_or(false)).count(),
        local_exists: items.iter().filter(|i| i.excluded_reason.as_deref() == Some("本地已存在")).count(),
        final_download: items.iter().filter(|i| i.excluded_reason.is_none()).count(),
    };

    let _ = tx.send(ProgressEvent::ScanComplete { items, stats }).await;
    Ok(())
}

/// Build the full annotated ScanItem list (all candidates with exclusion reasons).
async fn build_scan_items(
    config: &AppConfig,
    client: &Arc<reqwest::Client>,
    target_date: &str,
    base_dir: &Path,
    _tx: &mpsc::Sender<ProgressEvent>,
    cancel: &Arc<tokio::sync::Notify>,
) -> Result<Vec<ScanItem>> {
    let enabled_sites: Vec<crate::models::WebsiteConfig> = config.websites.values()
        .filter(|s| s.enabled).cloned().collect();

    let mut all_candidates: Vec<BookCandidate> = Vec::new();

    // 并发扫描所有站点（kumo multi-spider），失败时降级到串行
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
                if cancel.notified().now_or_never().is_some() { return Ok(vec![]); }
                match crate::crawler::scan_site(client, site_cfg, &config.network, target_date).await {
                    Ok(mut candidates) => {
                        // Fill missing names
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
                                    let name = crate::crawler::fetch_novel_name(&client, &url, &xpath, &enc, rc, rd).await;
                                    (url, name)
                                })
                            }).collect();
                        let name_map: HashMap<String, String> = futures::future::join_all(fill_tasks).await
                            .into_iter().filter_map(|r| r.ok())
                            .filter_map(|(url, name)| name.map(|n| (url, n)))
                            .collect();
                        for c in candidates.iter_mut() {
                            if c.name.is_empty() {
                                if let Some(n) = name_map.get(&c.url) { c.name = n.clone(); }
                            }
                        }
                        all_candidates.extend(candidates.into_iter().filter(|c| !c.name.is_empty()));
                    }
                    Err(_) => {}
                }
            }
        }
    }

    let total_collected = all_candidates.len();
    let mut items: Vec<ScanItem> = Vec::with_capacity(total_collected);

    // Dedup pass
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

    // Blacklist
    let blacklist = crate::blacklist::Blacklist::new(&config.blacklist);

    for c in all_candidates {
        let is_dup = dup_names.contains(&c.name) && name_map.get(&c.name).map(|e| e.url != c.url).unwrap_or(false);
        let excluded_reason = if is_dup {
            Some("重复".to_string())
        } else if config.blacklist.enabled {
            let (blocked, reason) = blacklist.is_blocked(&c.name);
            if blocked { Some(format!("黑名单: {}", reason)) } else { None }
        } else {
            None
        };

        let excluded_reason = if excluded_reason.is_none() {
            if base_dir.join(format!("{}.txt", c.name)).exists() {
                Some("本地已存在".to_string())
            } else {
                None
            }
        } else {
            excluded_reason
        };

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

// ─── Public: download a pre-selected list ────────────────────────────────────

/// Download only the novels whose URLs are in `selected_urls`.
/// The candidates must have been obtained from a prior scan.
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

    let client = Arc::new(build_client_with_pool(&config.network, config.concurrency.max_connections_per_host)?);
    let base_dir = PathBuf::from(&config.paths.base_dir);
    let log_dir = PathBuf::from(&config.paths.log_dir);
    tokio::fs::create_dir_all(&base_dir).await?;

    let logger = FileLogger::new(&log_dir).await;

    let n = selected.len();
    log(&tx, logger.as_ref(), "info", format!("开始下载选中的 {} 本书...", n)).await;

    // Emit FilterDone so UI shows stats
    let _ = tx.send(ProgressEvent::FilterDone {
        stats: crate::models::DownloadStats {
            total_collected: n, after_dedup: n,
            blacklist_filtered: 0, local_exists: 0, final_download: n,
        },
    }).await;

    let site_map: HashMap<String, WebsiteConfig> = config.websites.values()
        .map(|s| (s.domain_name.clone(), s.clone())).collect();

    let novel_sem = Arc::new(Semaphore::new(config.concurrency.novel_threads));
    let chapter_sem = Arc::new(Semaphore::new(config.concurrency.chapter_threads));
    let remaining: Arc<Mutex<Vec<BookCandidate>>> = Arc::new(Mutex::new(selected.clone()));

    let mut tasks = Vec::new();

    let content_filter_sel = config.content_filter.clone();
    let ttks_cfg_sel = config.ttks.clone();

    for candidate in selected {
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
        let content_filter_sel = content_filter_sel.clone();
        let ttks_cfg_sel = ttks_cfg_sel.clone();

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
                content_filter_sel, ttks_cfg_sel,
            ).await;

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

            let mut rem = remaining.lock().await;
            rem.retain(|c| c.name != name);
            drop(rem);
        }));
    }

    futures::future::join_all(tasks).await;

    let _ = crate::config::update_last_download_date(
        &Local::now().format("%Y-%m-%d").to_string()
    );

    log(&tx, logger.as_ref(), "success", "所有下载任务完成！".into()).await;
    let _ = tx.send(ProgressEvent::OverallDone).await;
    Ok(())
}

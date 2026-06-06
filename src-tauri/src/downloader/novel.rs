use std::path::{Path, PathBuf};
use std::sync::Arc;
use anyhow::Result;
use backon::{ExponentialBuilder, Retryable};
use tokio::sync::{Semaphore, mpsc};
use futures::FutureExt;

use crate::models::{
    BookCandidate, EbookConversionConfig, NetworkConfig, ProgressEvent,
    TextConversionConfig, WebsiteConfig,
};
use crate::crawler::{download_chapter_paged, get_chapter_urls};
use crate::text_converter;
use crate::ebook_converter;

// ─── Single novel download ────────────────────────────────────────────────────

pub async fn download_novel(
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
    cfg_rate_limit: crate::models::RateLimitConfig,
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
    let rate_limit_cfg = cfg_rate_limit.clone();
    let xpath_fallbacks = site_cfg.novel_content_fallbacks.clone();
    let temp_dir = base_dir.join(format!("temp_{}", candidate.name));
    tokio::fs::create_dir_all(&temp_dir).await?;

    let counter = Arc::new(std::sync::atomic::AtomicUsize::new(0));

    // ── First pass ────────────────────────────────────────────────────────────
    let first_results = run_first_pass(
        client, &chapter_urls, site_cfg, net_cfg,
        &temp_dir, &chapter_sem, &cancel, &tx,
        &candidate.name, &counter, total_chapters,
        &text_conv, &rate_limit_cfg, &content_filter, &xpath_fallbacks,
    ).await;

    let failed_indices: Vec<usize> = first_results.iter().enumerate()
        .filter(|(_, r)| r.as_ref().map(|i| i.is_err()).unwrap_or(true))
        .map(|(i, _)| i)
        .collect();

    // ── Repair pass ───────────────────────────────────────────────────────────
    let still_failed = run_repair_pass(
        client, &chapter_urls, site_cfg, net_cfg,
        &temp_dir, &tx, &candidate.name,
        total_chapters, failed_indices,
    ).await?;

    // ── Merge ─────────────────────────────────────────────────────────────────
    let final_path = base_dir.join(format!("{}.txt", candidate.name));
    merge_chapters(&temp_dir, &final_path, total_chapters).await?;
    let _ = tokio::fs::remove_dir_all(&temp_dir).await;

    // ── Ebook conversion ──────────────────────────────────────────────────────
    if ebook_conv.enabled && !ebook_conv.formats.is_empty() {
        convert_ebook(&final_path, &ebook_conv, &tx).await;
    }

    let _ = still_failed; // already checked inside repair pass
    Ok(())
}

// ─── First pass: download all chapters concurrently ──────────────────────────

async fn run_first_pass(
    client: &reqwest::Client,
    chapter_urls: &[String],
    site_cfg: &WebsiteConfig,
    net_cfg: &NetworkConfig,
    temp_dir: &Path,
    chapter_sem: &Arc<Semaphore>,
    cancel: &Arc<tokio::sync::Notify>,
    tx: &mpsc::Sender<ProgressEvent>,
    novel_name: &str,
    counter: &Arc<std::sync::atomic::AtomicUsize>,
    total_chapters: usize,
    text_conv: &TextConversionConfig,
    rate_limit_cfg: &crate::models::RateLimitConfig,
    content_filter: &crate::models::ContentFilterConfig,
    xpath_fallbacks: &[String],
) -> Vec<Result<Result<(), anyhow::Error>, tokio::task::JoinError>> {
    let tasks: Vec<_> = chapter_urls.iter().enumerate().map(|(idx, url)| {
        let client = client.clone();
        let url = url.clone();
        let xpath = site_cfg.novel_content.clone();
        let next_page_xpath = site_cfg.chapter_next_page_xpath.clone();
        let enc = net_cfg.encoding_map.clone();
        let rc = net_cfg.retry_count;
        let rd = net_cfg.retry_delay;
        let proxy = net_cfg.proxy.clone();
        let timeout = net_cfg.timeout;
        let temp_dir = temp_dir.to_path_buf();
        let sem = chapter_sem.clone();
        let cancel = cancel.clone();
        let tx = tx.clone();
        let novel = novel_name.to_string();
        let ctr = counter.clone();
        let tc = text_conv.clone();
        let rate_limit_cfg = rate_limit_cfg.clone();
        let content_filter = content_filter.clone();
        let xpath_fallbacks = xpath_fallbacks.to_vec();

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

            // 限速规则匹配下载器 vs 通用下载器
            let text = if let Some(rule) = crate::ttks_downloader::find_rate_limit_rule(&url, &rate_limit_cfg) {
                let rule = rule.clone();
                let proxy_opt = proxy.as_deref().filter(|p| !p.is_empty());
                match crate::ttks_downloader::build_ttks_client(proxy_opt, timeout, &rule) {
                    Ok(rl_client) => {
                        let domain = url.split('/').take(3).collect::<Vec<_>>().join("/");
                        crate::ttks_downloader::fetch_ttks_chapter(
                            &rl_client, &url, &domain,
                            &xpath, &xpath_fallbacks, &enc, rc, rd, &rule, &content_filter,
                        ).await?
                    }
                    Err(_) => {
                        download_chapter_paged(
                            &client, &url, &xpath, &xpath_fallbacks,
                            &enc, rc, rd, &content_filter, &next_page_xpath,
                        ).await?
                    }
                }
            } else {
                download_chapter_paged(
                    &client, &url, &xpath, &xpath_fallbacks,
                    &enc, rc, rd, &content_filter, &next_page_xpath,
                ).await?
            };

            if !text.is_empty() {
                let out = if tc.enabled && tc.traditional_to_simplified {
                    text_converter::detect_and_convert(&text, tc.auto_detect).0
                } else {
                    text
                };
                tokio::fs::write(&temp_file, out.as_bytes()).await?;
            }

            let done = ctr.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
            let _ = tx.send(ProgressEvent::ChapterDone {
                novel, current: done, total: total_chapters,
            }).await;
            Ok(())
        })
    }).collect();

    futures::future::join_all(tasks).await
}

// ─── Repair pass: retry failed/small chapters ─────────────────────────────────

async fn run_repair_pass(
    client: &reqwest::Client,
    chapter_urls: &[String],
    site_cfg: &WebsiteConfig,
    net_cfg: &NetworkConfig,
    temp_dir: &Path,
    tx: &mpsc::Sender<ProgressEvent>,
    novel_name: &str,
    total_chapters: usize,
    failed_indices: Vec<usize>,
) -> Result<()> {
    // Collect small files too
    let mut small_indices: Vec<usize> = Vec::new();
    for idx in 0..total_chapters {
        let f = temp_dir.join(format!("{:04}.txt", idx));
        if f.exists() {
            if let Ok(m) = tokio::fs::metadata(&f).await {
                if m.len() < 1024 {
                    small_indices.push(idx);
                }
            }
        }
    }

    let mut repair_set = failed_indices.clone();
    for i in &small_indices {
        if !repair_set.contains(i) {
            repair_set.push(*i);
        }
    }
    repair_set.sort_unstable();

    if !repair_set.is_empty() {
        let _ = tx.send(ProgressEvent::Log {
            message: format!("{}: 修复 {} 个问题章节...", novel_name, repair_set.len()),
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
            let temp_dir = temp_dir.to_path_buf();
            let sem = repair_sem.clone();

            tokio::spawn(async move {
                let _p = sem.acquire().await.unwrap();
                let result = (|| async {
                    let text = download_chapter_paged(
                        &client, &url, &xpath, &[],
                        &enc, rc, rd,
                        &crate::models::ContentFilterConfig::default(),
                        "",
                    ).await?;
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
            .map(|(i, _)| i)
            .collect();

        if !still_failed.is_empty() {
            let _ = tx.send(ProgressEvent::Log {
                message: format!("{}: {} 个章节修复失败，将跳过",
                    novel_name, still_failed.len()),
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
                "章节下载失败过多: {}/{}",
                failed_indices.len(), total_chapters
            ));
        }
    }

    Ok(())
}

// ─── Merge chapter files into final txt ──────────────────────────────────────

pub async fn merge_chapters(temp_dir: &Path, final_path: &Path, total: usize) -> Result<()> {
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

// ─── Ebook conversion helper ──────────────────────────────────────────────────

async fn convert_ebook(
    final_path: &Path,
    ebook_conv: &EbookConversionConfig,
    tx: &mpsc::Sender<ProgressEvent>,
) {
    for fmt in &ebook_conv.formats {
        let calibre = ebook_conv.calibre_path.as_ref().map(PathBuf::from);
        match ebook_converter::convert(final_path.to_path_buf(), fmt, calibre).await {
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

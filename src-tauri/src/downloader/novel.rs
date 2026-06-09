#[path = "novel_pass.rs"]
mod novel_pass;
use novel_pass::{convert_ebook, run_first_pass, run_repair_pass};

use anyhow::Result;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::{mpsc, Semaphore};

use crate::crawler::{get_chapter_urls, sanitize_filename};
use crate::models::{
    BookCandidate, EbookConversionConfig, NetworkConfig, ProgressEvent, TextConversionConfig,
    WebsiteConfig,
};

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
        client,
        &candidate.url,
        &site_cfg.chapter_url_x,
        &site_cfg.domain_name,
        &net_cfg.encoding_map,
        net_cfg.retry_count,
        net_cfg.retry_delay,
    )
    .await?;

    if chapter_urls.is_empty() {
        return Err(anyhow::anyhow!("没有找到章节链接"));
    }

    let total_chapters = chapter_urls.len();
    let mut content_filter = cfg_content_filter.clone();
    if site_cfg.site_ad_rules.enabled {
        content_filter
            .ad_patterns
            .extend(site_cfg.site_ad_rules.regex_rules.iter().cloned());
        content_filter
            .nav_keywords
            .extend(site_cfg.site_ad_rules.nav_keywords.iter().cloned());
        content_filter
            .site_xpath_rules
            .extend(site_cfg.site_ad_rules.xpath_rules.iter().cloned());
        if site_cfg.site_ad_rules.trim_head > 0 {
            content_filter.site_trim_head = site_cfg.site_ad_rules.trim_head;
        }
        if site_cfg.site_ad_rules.trim_tail > 0 {
            content_filter.site_trim_tail = site_cfg.site_ad_rules.trim_tail;
        }
    }
    let rate_limit_cfg = cfg_rate_limit.clone();
    let xpath_fallbacks = site_cfg.novel_content_fallbacks.clone();
    let safe_name = sanitize_filename(&candidate.name);
    let temp_dir = base_dir.join(format!("temp_{}", safe_name));
    tokio::fs::create_dir_all(&temp_dir).await?;

    let counter = Arc::new(std::sync::atomic::AtomicUsize::new(0));

    // ── First pass ────────────────────────────────────────────────────────────
    let first_results = run_first_pass(
        client,
        &chapter_urls,
        site_cfg,
        net_cfg,
        &temp_dir,
        &chapter_sem,
        &cancel,
        &tx,
        &safe_name,
        &counter,
        total_chapters,
        &text_conv,
        &rate_limit_cfg,
        &content_filter,
        &xpath_fallbacks,
    )
    .await;

    let failed_indices: Vec<usize> = first_results
        .iter()
        .enumerate()
        .filter(|(_, r)| r.as_ref().map(|i| i.is_err()).unwrap_or(true))
        .map(|(i, _)| i)
        .collect();

    // ── Repair pass ───────────────────────────────────────────────────────────
    let still_failed = run_repair_pass(
        client,
        &chapter_urls,
        site_cfg,
        net_cfg,
        &temp_dir,
        &tx,
        &safe_name,
        total_chapters,
        failed_indices,
        &content_filter,
        &xpath_fallbacks,
    )
    .await?;

    // ── Merge ─────────────────────────────────────────────────────────────────
    let final_path = base_dir.join(format!("{}.txt", safe_name));
    merge_chapters(&temp_dir, &final_path, total_chapters).await?;
    let _ = tokio::fs::remove_dir_all(&temp_dir).await;

    // ── Ebook conversion ──────────────────────────────────────────────────────
    if ebook_conv.enabled && !ebook_conv.formats.is_empty() {
        convert_ebook(&final_path, &ebook_conv, &tx).await;
    }

    let _ = still_failed; // already checked inside repair pass
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::sanitize_filename;

    #[test]
    fn sanitize_candidate_name_blocks_path_traversal_segments() {
        let safe = sanitize_filename(r"..\..\Windows/system.ini");

        assert!(!safe.contains('\\'));
        assert!(!safe.contains('/'));
        assert_ne!(safe, "..");
        assert!(!safe.is_empty());
    }
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
            } else {
                // File exists but is empty — write a placeholder so the gap is visible
                file.write_all(format!("\n【第 {} 章内容下载失败，已跳过】\n\n", i + 1).as_bytes())
                    .await?;
            }
        } else {
            // File missing entirely — write a placeholder so the gap is visible
            file.write_all(format!("\n【第 {} 章内容缺失，已跳过】\n\n", i + 1).as_bytes())
                .await?;
        }
    }
    file.flush().await?;
    Ok(())
}

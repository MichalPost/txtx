use std::path::Path;
use anyhow::Result;
use chrono::Local;
use serde::{Deserialize, Serialize};

use crate::models::BookCandidate;

// ─── Queue persistence ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadQueue {
    pub created_at: String,
    pub target_date: String,
    pub items: Vec<BookCandidate>,
}

pub async fn save_queue(base_dir: &Path, queue: &DownloadQueue) -> Result<()> {
    let path = base_dir.join("download_queue.json");
    let json = serde_json::to_string_pretty(queue)?;
    tokio::fs::write(&path, json.as_bytes()).await?;
    Ok(())
}

pub async fn load_queue(base_dir: &Path) -> Option<DownloadQueue> {
    let path = base_dir.join("download_queue.json");
    let data = tokio::fs::read_to_string(&path).await.ok()?;
    serde_json::from_str(&data).ok()
}

pub async fn remove_queue(base_dir: &Path) {
    let _ = tokio::fs::remove_file(base_dir.join("download_queue.json")).await;
}

pub fn make_queue_snapshot(
    target_date: impl Into<String>,
    items: Vec<BookCandidate>,
) -> DownloadQueue {
    DownloadQueue {
        created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        target_date: target_date.into(),
        items,
    }
}

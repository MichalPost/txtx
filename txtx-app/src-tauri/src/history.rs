/// Download history — persisted as JSON in base_dir/download_history.json

use std::path::Path;
use anyhow::Result;
use chrono::Local;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub name: String,
    pub url: String,
    pub site: String,
    pub downloaded_at: String,
    pub status: String, // "success" | "error"
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct HistoryFile {
    entries: Vec<HistoryEntry>,
}

fn history_path(base_dir: &Path) -> std::path::PathBuf {
    base_dir.join("download_history.json")
}

pub async fn load_history(base_dir: &Path) -> Result<Vec<HistoryEntry>> {
    let path = history_path(base_dir);
    if !path.exists() { return Ok(vec![]); }
    let data = tokio::fs::read_to_string(&path).await?;
    let hf: HistoryFile = serde_json::from_str(&data).unwrap_or_default();
    Ok(hf.entries)
}

pub async fn append_entry(base_dir: &Path, entry: HistoryEntry) -> Result<()> {
    let mut entries = load_history(base_dir).await.unwrap_or_default();
    entries.push(entry);
    // Keep last 2000 entries
    if entries.len() > 2000 {
        entries.drain(0..entries.len() - 2000);
    }
    let json = serde_json::to_string_pretty(&HistoryFile { entries })?;
    tokio::fs::write(history_path(base_dir), json.as_bytes()).await?;
    Ok(())
}

pub async fn clear_history(base_dir: &Path) -> Result<()> {
    let path = history_path(base_dir);
    if path.exists() { tokio::fs::remove_file(&path).await?; }
    Ok(())
}

pub fn make_entry(
    name: &str,
    url: &str,
    site: &str,
    status: &str,
    message: Option<String>,
) -> HistoryEntry {
    HistoryEntry {
        name: name.to_string(),
        url: url.to_string(),
        site: site.to_string(),
        downloaded_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        status: status.to_string(),
        message,
    }
}

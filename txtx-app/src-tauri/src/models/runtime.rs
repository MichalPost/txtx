use serde::{Deserialize, Serialize};

// ─── Runtime types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookCandidate {
    pub name: String,
    pub url: String,
    pub crawler_domain: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadStats {
    pub total_collected: usize,
    pub after_dedup: usize,
    pub blacklist_filtered: usize,
    pub local_exists: usize,
    pub final_download: usize,
}

/// Result of a site health check ping
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteHealth {
    pub domain: String,
    pub reachable: bool,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
}

/// A single scanned novel candidate with filter metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanItem {
    pub name: String,
    pub url: String,
    pub site: String,
    pub date: String,
    /// Why this item was excluded (None = included in download list)
    pub excluded_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ProgressEvent {
    Log {
        message: String,
        level: String,
    },
    ScanStart {
        site: String,
    },
    ScanDone {
        site: String,
        total: usize,
    },
    FilterDone {
        stats: DownloadStats,
    },
    NovelStart {
        novel: String,
        site: String,
    },
    /// Emitted each time a chapter finishes downloading
    ChapterDone {
        novel: String,
        current: usize,
        total: usize,
    },
    NovelDone {
        novel: String,
        site: String,
    },
    NovelError {
        novel: String,
        site: String,
        message: String,
    },
    OverallDone,
    /// Emitted after scan+filter completes, carries the full item list
    ScanComplete {
        items: Vec<ScanItem>,
        stats: DownloadStats,
    },
}

// ─── Task Manager Types ───────────────────────────────────────────────────────

pub type TaskId = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TaskKind {
    FullScan,
    BatchDownload,
    SelectedDownload,
    SingleDownload,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Queued,
    Scanning,
    Preview,
    Downloading,
    Paused,
    Done,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRecord {
    pub id: TaskId,
    pub kind: TaskKind,
    pub status: TaskStatus,
    pub label: String,
    pub created_at: String,
    pub finished_at: Option<String>,
    pub total: usize,
    pub completed: usize,
    pub success_count: usize,
    pub error_count: usize,
    pub scan_items: Vec<ScanItem>,
    pub scan_stats: Option<DownloadStats>,
    pub stats: Option<DownloadStats>,
    pub error_message: Option<String>,
}

/// Wraps any ProgressEvent with its owning task_id for frontend fan-out
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskEvent {
    pub task_id: TaskId,
    #[serde(flatten)]
    pub event: ProgressEvent,
}

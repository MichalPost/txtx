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
    pub source_url: Option<String>,
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

// ─── AI Types ─────────────────────────────────────────────────────────────────

/// LLM provider config sent from frontend with each request.
/// API key is kept in browser IndexedDB and forwarded here — never stored server-side.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiCallConfig {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub max_tokens: u16,
    pub temperature: f32,
}

/// Request body for non-streaming AI completion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiCompleteRequest {
    pub config: AiCallConfig,
    pub system_prompt: String,
    pub user_prompt: String,
}

/// Response for non-streaming AI completion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiCompleteResponse {
    pub text: String,
}

/// Request body for kumo-backed structured extraction.
/// `schema` is a JSON Schema object describing the fields to extract.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiExtractRequest {
    pub config: AiCallConfig,
    pub schema: serde_json::Value,
    pub html: String,
}

/// Response for structured extraction — the extracted JSON object.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiExtractResponse {
    pub data: serde_json::Value,
}

/// Tauri event payload for streaming AI tokens
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiTokenEvent {
    /// Client-generated ID to match stream events to a particular request
    pub stream_id: String,
    /// None = normal token, Some(msg) = error, empty string token = stream done
    pub token: Option<String>,
    pub done: bool,
    pub error: Option<String>,
}

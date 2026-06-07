pub mod db;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{Mutex, Notify};
use chrono::Local;
use uuid::Uuid;

use crate::models::{TaskId, TaskKind, TaskRecord, TaskStatus};

pub struct TaskHandle {
    pub record: TaskRecord,
    pub cancel: Arc<Notify>,
}

pub struct TaskManager {
    pub handles: HashMap<TaskId, TaskHandle>,
    pub base_dir: PathBuf,
    pub max_concurrent: usize,
}

impl TaskManager {
    pub fn new(base_dir: PathBuf) -> Self {
        Self {
            handles: HashMap::new(),
            base_dir,
            max_concurrent: 3,
        }
    }

    /// Create a TaskManager with a custom concurrency limit (clamped to 1..=5).
    pub fn new_with_max(base_dir: PathBuf, max_concurrent: usize) -> Self {
        Self {
            handles: HashMap::new(),
            base_dir,
            max_concurrent: max_concurrent.clamp(1, 5),
        }
    }

    pub fn new_task_id() -> TaskId {
        Uuid::new_v4().to_string()
    }

    pub fn running_count(&self) -> usize {
        self.handles.values().filter(|h| {
            matches!(
                h.record.status,
                // Preview means the scan worker has finished and we are waiting
                // for the user to confirm — no worker is actively consuming
                // resources, so it must NOT count against the concurrency limit.
                TaskStatus::Scanning | TaskStatus::Downloading
            )
        }).count()
    }

    pub fn get_record(&self, id: &str) -> Option<&TaskRecord> {
        self.handles.get(id).map(|h| &h.record)
    }

    pub fn list_records(&self) -> Vec<TaskRecord> {
        let mut records: Vec<TaskRecord> = self.handles.values()
            .map(|h| h.record.clone())
            .collect();
        records.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        records
    }

    pub fn upsert(&mut self, record: TaskRecord, cancel: Arc<Notify>) {
        self.handles.insert(record.id.clone(), TaskHandle { record, cancel });
    }

    pub fn update_record<F>(&mut self, id: &str, f: F) -> bool
    where
        F: FnOnce(&mut TaskRecord),
    {
        if let Some(h) = self.handles.get_mut(id) {
            f(&mut h.record);
            true
        } else {
            false
        }
    }

    pub fn cancel_task(&self, id: &str) -> bool {
        if let Some(h) = self.handles.get(id) {
            h.cancel.notify_waiters();
            true
        } else {
            false
        }
    }

    pub fn remove_task(&mut self, id: &str) -> bool {
        if let Some(h) = self.handles.get(id) {
            h.cancel.notify_waiters();
        }
        self.handles.remove(id).is_some()
    }

    pub fn make_label(kind: &TaskKind, extra: &str) -> String {
        let prefix = match kind {
            TaskKind::FullScan => "扫描",
            TaskKind::BatchDownload => "批量下载",
            TaskKind::SelectedDownload => "精选下载",
            TaskKind::SingleDownload => "单本下载",
        };
        let ts = Local::now().format("%m-%d %H:%M").to_string();
        if extra.is_empty() {
            format!("{} {}", prefix, ts)
        } else {
            format!("{} {}", prefix, extra)
        }
    }
}

pub type SharedTaskManager = Arc<Mutex<TaskManager>>;

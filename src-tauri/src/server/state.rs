use std::sync::Arc;
use std::path::PathBuf;
use tokio::sync::{Mutex, Notify};
use crate::task_manager::SharedTaskManager;

pub struct DownloadState {
    pub cancel: Arc<Notify>,
    pub running: bool,
}

pub type SharedDownloadState = Arc<Mutex<DownloadState>>;

#[derive(Clone)]
pub struct AppState {
    pub download: SharedDownloadState,
    /// Base directory for DB files (loaded from config at server startup)
    pub base_dir: PathBuf,
    /// Task manager (mirrors Tauri mode)
    pub task_manager: SharedTaskManager,
}

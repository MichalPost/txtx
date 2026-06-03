use std::sync::Arc;
use std::path::PathBuf;
use tokio::sync::{Mutex, Notify};

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
}

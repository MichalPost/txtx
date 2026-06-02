use std::sync::Arc;
use tokio::sync::{Mutex, Notify};

pub struct DownloadState {
    pub cancel: Arc<Notify>,
    pub running: bool,
}

pub type SharedDownloadState = Arc<Mutex<DownloadState>>;

#[derive(Clone)]
pub struct AppState {
    pub download: SharedDownloadState,
}

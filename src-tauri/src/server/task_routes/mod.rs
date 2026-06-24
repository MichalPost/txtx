//! HTTP REST routes for the task manager (dev/server mode).
//!
//! Mirrors the Tauri invoke commands in lib.rs so the frontend works
//! identically in both environments.

mod download;
mod manage;
mod scan;

pub use download::*;
pub use manage::*;
pub use scan::*;

use crate::server::state::AppState;

pub(super) async fn load_cfg(state: &AppState) -> Result<crate::models::AppConfig, String> {
    let dir = state.base_dir.clone();
    tokio::task::spawn_blocking(move || crate::config_db::load_config(&dir))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

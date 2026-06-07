use tauri::{AppHandle, State};
use super::worker::app_data_dir;

#[tauri::command]
pub async fn load_config(app: AppHandle) -> Result<crate::models::AppConfig, String> {
    let dir = app_data_dir(&app);
    tokio::task::spawn_blocking(move || {
        crate::config_db::load_config(&dir)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_config(app: AppHandle, config: crate::models::AppConfig) -> Result<(), String> {
    let dir = app_data_dir(&app);
    tokio::task::spawn_blocking(move || {
        crate::config_db::save_config(&dir, &config)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// Returns true when the user has not yet finished the setup wizard.
#[tauri::command]
pub async fn check_first_run(app: AppHandle) -> bool {
    let dir = app_data_dir(&app);
    tokio::task::spawn_blocking(move || crate::config_db::is_first_run(&dir))
        .await
        .unwrap_or(true)
}

/// Called by the setup wizard when the user finishes onboarding.
/// Writes the chosen base_dir to the DB and marks setup as complete.
#[tauri::command]
pub async fn complete_setup(app: AppHandle, base_dir: String) -> Result<(), String> {
    let dir = app_data_dir(&app);
    let base_dir_clone = base_dir.clone();
    tokio::task::spawn_blocking(move || -> anyhow::Result<()> {
        // Migrate legacy config.yml if present
        crate::config_db::maybe_migrate_from_yaml(&dir);

        // Load existing config (or default) and inject the chosen base_dir
        let mut cfg = crate::config_db::load_config(&dir)?;
        if cfg.paths.base_dir.is_empty() {
            cfg.paths.base_dir = base_dir_clone.clone();
            let temp = std::path::Path::new(&base_dir_clone).join("temp");
            let logs = std::path::Path::new(&base_dir_clone).join("logs");
            cfg.paths.temp_dir = temp.to_string_lossy().to_string();
            cfg.paths.log_dir = logs.to_string_lossy().to_string();
        }
        crate::config_db::save_config(&dir, &cfg)?;
        crate::config_db::mark_setup_complete(&dir)?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// Select a directory via native dialog (alias for tauri_plugin_dialog,
/// kept for compatibility if called via invoke from legacy code).
#[tauri::command]
pub async fn pick_directory(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app.dialog().file().blocking_pick_folder();
    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn fetch_source(app: AppHandle, url: String) -> Result<String, String> {
    let dir = app_data_dir(&app);
    let cfg = tokio::task::spawn_blocking(move || crate::config_db::load_config(&dir))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    let client = crate::crawler::build_client(&cfg.network).map_err(|e| e.to_string())?;
    crate::crawler::http_client::fetch_page(
        &client,
        &url,
        &cfg.network.encoding_map,
        cfg.network.retry_count,
        cfg.network.retry_delay,
    )
    .await
    .map_err(|e| e.to_string())
}

pub mod models;
pub mod config;
pub mod blacklist;
pub mod crawler;
pub mod downloader;
pub mod server;
pub mod text_converter;
pub mod ebook_converter;
pub mod history;
pub mod task_manager;
pub mod single_downloader;
pub mod ttks_downloader;

#[cfg(debug_assertions)]
pub mod dev_tools;

pub mod kumo_scanner;

// ─── Tauri integration ────────────────────────────────────────────────────────

#[cfg(feature = "tauri-build")]
mod tauri_app {
    use std::sync::Arc;
    use tokio::sync::{mpsc, Mutex, Notify};
    use tauri::{AppHandle, Emitter, State};
    use crate::models::ProgressEvent;

    struct DownloadState {
        cancel: Arc<Notify>,
        running: bool,
    }
    type SharedDownloadState = Arc<Mutex<DownloadState>>;

    // ── Config ────────────────────────────────────────────────────────────────

    #[tauri::command]
    async fn load_config() -> Result<crate::models::AppConfig, String> {
        crate::config::load_config().map_err(|e| e.to_string())
    }

    #[tauri::command]
    async fn save_config(config: crate::models::AppConfig) -> Result<(), String> {
        crate::config::save_config(&config).map_err(|e| e.to_string())
    }

    // ── Batch download ────────────────────────────────────────────────────────

    #[tauri::command]
    async fn start_scan(
        app: AppHandle,
        state: State<'_, SharedDownloadState>,
        options: Option<crate::downloader::ScanOptions>,
    ) -> Result<(), String> {
        let mut guard = state.lock().await;
        if guard.running { return Err("扫描/下载已在运行中".into()); }

        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        let cancel = Arc::new(Notify::new());
        guard.cancel = cancel.clone();
        guard.running = true;
        drop(guard);

        let (tx, mut rx) = mpsc::channel::<ProgressEvent>(256);
        let state_clone = state.inner().clone();
        let app_clone = app.clone();

        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                let _ = app_clone.emit("download_progress", &event);
            }
            state_clone.lock().await.running = false;
        });

        let opts = options.unwrap_or_default();
        tokio::spawn(async move {
            let _ = crate::downloader::run_scan_with_options(cfg, opts, tx, cancel).await;
        });

        Ok(())
    }

    #[tauri::command]
    async fn download_selected(
        app: AppHandle,
        state: State<'_, SharedDownloadState>,
        selected: Vec<crate::models::BookCandidate>,
    ) -> Result<(), String> {
        let mut guard = state.lock().await;
        if guard.running { return Err("下载已在运行中".into()); }

        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        let cancel = Arc::new(Notify::new());
        guard.cancel = cancel.clone();
        guard.running = true;
        drop(guard);

        let (tx, mut rx) = mpsc::channel::<ProgressEvent>(256);
        let state_clone = state.inner().clone();
        let app_clone = app.clone();

        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                let _ = app_clone.emit("download_progress", &event);
            }
            state_clone.lock().await.running = false;
        });

        tokio::spawn(async move {
            let _ = crate::downloader::run_download_selected(cfg, selected, tx, cancel).await;
        });

        Ok(())
    }

    #[tauri::command]
    async fn start_download(
        app: AppHandle,
        state: State<'_, SharedDownloadState>,
    ) -> Result<(), String> {
        let mut guard = state.lock().await;
        if guard.running { return Err("下载已在运行中".into()); }

        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        let cancel = Arc::new(Notify::new());
        guard.cancel = cancel.clone();
        guard.running = true;
        drop(guard);

        let (tx, mut rx) = mpsc::channel::<ProgressEvent>(256);
        let state_clone = state.inner().clone();
        let app_clone = app.clone();

        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                let _ = app_clone.emit("download_progress", &event);
            }
            state_clone.lock().await.running = false;
        });

        tokio::spawn(async move {
            let _ = crate::downloader::run_download(cfg, tx, cancel).await;
        });

        Ok(())
    }

    #[tauri::command]
    async fn stop_download(state: State<'_, SharedDownloadState>) -> Result<(), String> {
        state.lock().await.cancel.notify_waiters();
        Ok(())
    }

    // ── Single novel download ─────────────────────────────────────────────────

    #[tauri::command]
    async fn download_single(
        app: AppHandle,
        state: State<'_, SharedDownloadState>,
        url: String,
    ) -> Result<(), String> {
        let mut guard = state.lock().await;
        if guard.running { return Err("下载已在运行中".into()); }

        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        let cancel = Arc::new(Notify::new());
        guard.cancel = cancel.clone();
        guard.running = true;
        drop(guard);

        let (tx, mut rx) = mpsc::channel::<ProgressEvent>(256);
        let state_clone = state.inner().clone();
        let app_clone = app.clone();

        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                let _ = app_clone.emit("download_progress", &event);
            }
            state_clone.lock().await.running = false;
        });

        tokio::spawn(async move {
            let _ = crate::single_downloader::download_single_novel(cfg, url, tx, cancel).await;
        });

        Ok(())
    }

    // ── History ───────────────────────────────────────────────────────────────

    #[tauri::command]
    async fn get_history() -> Result<Vec<crate::history::HistoryEntry>, String> {
        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
        crate::history::load_history(&base_dir).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    async fn clear_history() -> Result<(), String> {
        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
        crate::history::clear_history(&base_dir).await.map_err(|e| e.to_string())
    }

    // ── Site health check ─────────────────────────────────────────────────────

    #[tauri::command]
    async fn check_sites() -> Result<Vec<crate::models::SiteHealth>, String> {
        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        crate::crawler::check_site_health(&cfg).await.map_err(|e| e.to_string())
    }

    // ── Text conversion ───────────────────────────────────────────────────────

    #[tauri::command]
    async fn convert_file(path: String) -> Result<String, String> {
        let p = std::path::PathBuf::from(&path);
        let text = tokio::fs::read_to_string(&p).await
            .map_err(|e| e.to_string())?;
        let (converted, changed) = crate::text_converter::detect_and_convert(&text, true);
        if changed {
            tokio::fs::write(&p, converted.as_bytes()).await
                .map_err(|e| e.to_string())?;
            Ok(format!("转换完成: {}", p.display()))
        } else {
            Ok(format!("无需转换（未检测到繁体字）: {}", p.display()))
        }
    }

    // ── Queue ─────────────────────────────────────────────────────────────────

    #[tauri::command]
    async fn get_queue() -> Result<serde_json::Value, String> {
        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
        let path = base_dir.join("download_queue.json");
        if !path.exists() {
            return Ok(serde_json::json!({ "exists": false }));
        }
        let data = tokio::fs::read_to_string(&path).await.map_err(|e| e.to_string())?;
        let queue: serde_json::Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;
        let item_count = queue["items"].as_array().map(|a| a.len()).unwrap_or(0);
        Ok(serde_json::json!({
            "exists": true,
            "created_at": queue["created_at"],
            "target_date": queue["target_date"],
            "item_count": item_count,
        }))
    }

    #[tauri::command]
    async fn clear_queue() -> Result<(), String> {
        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
        let path = base_dir.join("download_queue.json");
        if path.exists() {
            tokio::fs::remove_file(&path).await.map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    // ── Novel name preview ────────────────────────────────────────────────────

    #[tauri::command]
    async fn preview_novel_name(url: String) -> Result<serde_json::Value, String> {
        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        let client = std::sync::Arc::new(
            crate::crawler::build_client(&cfg.network).map_err(|e| e.to_string())?
        );
        let site_cfg = cfg.websites.values()
            .find(|s| s.enabled && url.contains(&s.domain_name))
            .cloned();
        let xpath = site_cfg.as_ref().map(|s| s.novel_name_x.clone()).unwrap_or_default();
        if xpath.is_empty() {
            return Ok(serde_json::json!({ "name": null }));
        }
        match crate::crawler::fetch_novel_name(
            &client, &url, &xpath, &cfg.network.encoding_map,
            cfg.network.retry_count, cfg.network.retry_delay,
        ).await {
            Some(name) => Ok(serde_json::json!({ "name": name })),
            None => Ok(serde_json::json!({ "name": null })),
        }
    }

    // ── Open output directory ─────────────────────────────────────────────────

    #[tauri::command]
    async fn open_output_dir(app: tauri::AppHandle) -> Result<(), String> {
        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        use tauri_plugin_opener::OpenerExt;
        app.opener().open_path(&cfg.paths.base_dir, None::<&str>)
            .map_err(|e| e.to_string())
    }

    pub fn run() {
        let download_state: SharedDownloadState = Arc::new(Mutex::new(DownloadState {
            cancel: Arc::new(Notify::new()),
            running: false,
        }));

        tauri::Builder::default()
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_fs::init())
            .manage(download_state)
            .invoke_handler(tauri::generate_handler![
                load_config,
                save_config,
                start_scan,
                download_selected,
                start_download,
                stop_download,
                download_single,
                get_history,
                clear_history,
                check_sites,
                convert_file,
                get_queue,
                clear_queue,
                preview_novel_name,
                open_output_dir,
            ])
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }
}

#[cfg(feature = "tauri-build")]
pub use tauri_app::run;

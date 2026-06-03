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
    use crate::models::{ProgressEvent, TaskId, TaskKind, TaskRecord, TaskStatus, TaskEvent};
    use crate::task_manager::{TaskManager, SharedTaskManager};

    // ── Task worker helper ────────────────────────────────────────────────────

    async fn spawn_task_worker<F, Fut>(
        app: AppHandle,
        tm: SharedTaskManager,
        task_id: TaskId,
        future_factory: F,
    ) where
        F: FnOnce(mpsc::Sender<ProgressEvent>) -> Fut + Send + 'static,
        Fut: std::future::Future<Output = anyhow::Result<()>> + Send + 'static,
    {
        let (tx, mut rx) = mpsc::channel::<ProgressEvent>(512);

        let app_clone = app.clone();
        let tid = task_id.clone();
        let tm_rx = tm.clone();

        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                {
                    let mut mgr = tm_rx.lock().await;
                    match &event {
                        ProgressEvent::NovelDone { .. } => {
                            mgr.update_record(&tid, |r| {
                                r.completed = r.completed.saturating_add(1);
                                r.success_count += 1;
                            });
                        }
                        ProgressEvent::NovelError { .. } => {
                            mgr.update_record(&tid, |r| {
                                r.completed = r.completed.saturating_add(1);
                                r.error_count += 1;
                            });
                        }
                        ProgressEvent::FilterDone { stats } => {
                            let n = stats.final_download;
                            let s = stats.clone();
                            mgr.update_record(&tid, |r| {
                                r.total = n;
                                r.stats = Some(s);
                                r.status = TaskStatus::Downloading;
                            });
                        }
                        ProgressEvent::ScanComplete { items, stats } => {
                            let items2 = items.clone();
                            let stats2 = stats.clone();
                            mgr.update_record(&tid, |r| {
                                r.scan_items = items2;
                                r.scan_stats = Some(stats2);
                                r.status = TaskStatus::Preview;
                            });
                        }
                        ProgressEvent::ScanStart { .. } => {
                            mgr.update_record(&tid, |r| {
                                r.status = TaskStatus::Scanning;
                            });
                        }
                        ProgressEvent::OverallDone => {
                            let base_dir = mgr.base_dir.clone();
                            mgr.update_record(&tid, |r| {
                                r.status = TaskStatus::Done;
                                r.finished_at = Some(
                                    chrono::Local::now()
                                        .format("%Y-%m-%d %H:%M:%S")
                                        .to_string(),
                                );
                            });
                            if let Some(rec) = mgr.get_record(&tid).cloned() {
                                let _ = crate::task_manager::db::save_task(&base_dir, &rec).await;
                            }
                        }
                        _ => {}
                    }
                }
                let task_event = TaskEvent {
                    task_id: tid.clone(),
                    event,
                };
                let _ = app_clone.emit("task_event", &task_event);
            }
        });

        let tm_done = tm.clone();
        let tid2 = task_id.clone();
        tokio::spawn(async move {
            let result = future_factory(tx).await;
            if let Err(e) = result {
                let mut mgr = tm_done.lock().await;
                let err_str = e.to_string();
                mgr.update_record(&tid2, |r| {
                    r.status = TaskStatus::Failed;
                    r.error_message = Some(err_str);
                    r.finished_at = Some(
                        chrono::Local::now()
                            .format("%Y-%m-%d %H:%M:%S")
                            .to_string(),
                    );
                });
                let base_dir = mgr.base_dir.clone();
                if let Some(rec) = mgr.get_record(&tid2).cloned() {
                    let _ = crate::task_manager::db::save_task(&base_dir, &rec).await;
                }
            }
        });
    }

    // ── Config ────────────────────────────────────────────────────────────────

    #[tauri::command]
    async fn load_config() -> Result<crate::models::AppConfig, String> {
        crate::config::load_config().map_err(|e| e.to_string())
    }

    #[tauri::command]
    async fn save_config(config: crate::models::AppConfig) -> Result<(), String> {
        crate::config::save_config(&config).map_err(|e| e.to_string())
    }

    // ── Task Manager Commands ─────────────────────────────────────────────────

    #[tauri::command]
    async fn create_scan_task(
        app: AppHandle,
        tm: State<'_, SharedTaskManager>,
        options: Option<crate::downloader::ScanOptions>,
    ) -> Result<TaskId, String> {
        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        let task_id = TaskManager::new_task_id();
        let cancel = Arc::new(Notify::new());
        let label = TaskManager::make_label(&TaskKind::FullScan, "");
        let record = TaskRecord {
            id: task_id.clone(), kind: TaskKind::FullScan,
            status: TaskStatus::Scanning, label,
            created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            finished_at: None, total: 0, completed: 0,
            success_count: 0, error_count: 0,
            scan_items: vec![], scan_stats: None, stats: None, error_message: None,
        };
        {
            let mut mgr = tm.lock().await;
            mgr.upsert(record, cancel.clone());
        }
        let opts = options.unwrap_or_default();
        let cancel_clone = cancel.clone();
        spawn_task_worker(app, tm.inner().clone(), task_id.clone(), move |tx| async move {
            crate::downloader::run_scan_with_options(cfg, opts, tx, cancel_clone).await
        }).await;
        Ok(task_id)
    }

    #[tauri::command]
    async fn create_batch_download_task(
        app: AppHandle,
        tm: State<'_, SharedTaskManager>,
        options: Option<crate::downloader::ScanOptions>,
    ) -> Result<TaskId, String> {
        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        let task_id = TaskManager::new_task_id();
        let cancel = Arc::new(Notify::new());
        let label = TaskManager::make_label(&TaskKind::BatchDownload, "");
        let record = TaskRecord {
            id: task_id.clone(), kind: TaskKind::BatchDownload,
            status: TaskStatus::Scanning, label,
            created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            finished_at: None, total: 0, completed: 0,
            success_count: 0, error_count: 0,
            scan_items: vec![], scan_stats: None, stats: None, error_message: None,
        };
        {
            let mut mgr = tm.lock().await;
            mgr.upsert(record, cancel.clone());
        }
        let opts = options.unwrap_or_default();
        let cancel_clone = cancel.clone();
        spawn_task_worker(app, tm.inner().clone(), task_id.clone(), move |tx| async move {
            let mut cfg2 = cfg;
            if let Some(ref sites) = opts.enabled_sites {
                if !sites.is_empty() {
                    for s in cfg2.websites.values_mut() {
                        if !sites.contains(&s.domain_name) {
                            s.enabled = false;
                        }
                    }
                }
            }
            crate::downloader::run_download(cfg2, tx, cancel_clone).await
        }).await;
        Ok(task_id)
    }

    #[tauri::command]
    async fn create_single_download_task(
        app: AppHandle,
        tm: State<'_, SharedTaskManager>,
        url: String,
    ) -> Result<TaskId, String> {
        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        let task_id = TaskManager::new_task_id();
        let cancel = Arc::new(Notify::new());
        let url_label = url.trim_end_matches('/')
            .rsplit('/')
            .next()
            .unwrap_or("单本")
            .to_string();
        let label = TaskManager::make_label(&TaskKind::SingleDownload, &url_label);
        let record = TaskRecord {
            id: task_id.clone(), kind: TaskKind::SingleDownload,
            status: TaskStatus::Downloading, label,
            created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            finished_at: None, total: 1, completed: 0,
            success_count: 0, error_count: 0,
            scan_items: vec![], scan_stats: None, stats: None, error_message: None,
        };
        {
            let mut mgr = tm.lock().await;
            mgr.upsert(record, cancel.clone());
        }
        let cancel_clone = cancel.clone();
        spawn_task_worker(app, tm.inner().clone(), task_id.clone(), move |tx| async move {
            crate::single_downloader::download_single_novel(cfg, url, tx, cancel_clone).await
        }).await;
        Ok(task_id)
    }

    #[tauri::command]
    async fn confirm_task_download(
        app: AppHandle,
        tm: State<'_, SharedTaskManager>,
        task_id: TaskId,
        selected: Vec<crate::models::BookCandidate>,
    ) -> Result<(), String> {
        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        let cancel = Arc::new(Notify::new());
        let n = selected.len();
        {
            let mut mgr = tm.lock().await;
            mgr.update_record(&task_id, |r| {
                r.kind = TaskKind::SelectedDownload;
                r.status = TaskStatus::Downloading;
                r.total = n;
            });
            // Replace cancel handle for this task
            if let Some(h) = mgr.handles.get_mut(&task_id) {
                h.cancel = cancel.clone();
            }
        }
        let tid = task_id.clone();
        let cancel_clone = cancel.clone();
        spawn_task_worker(app, tm.inner().clone(), tid, move |tx| async move {
            crate::downloader::run_download_selected(cfg, selected, tx, cancel_clone).await
        }).await;
        Ok(())
    }

    #[tauri::command]
    async fn list_tasks(tm: State<'_, SharedTaskManager>) -> Result<Vec<TaskRecord>, String> {
        Ok(tm.lock().await.list_records())
    }

    #[tauri::command]
    async fn get_task(
        tm: State<'_, SharedTaskManager>,
        task_id: TaskId,
    ) -> Result<Option<TaskRecord>, String> {
        Ok(tm.lock().await.get_record(&task_id).cloned())
    }

    #[tauri::command]
    async fn cancel_task(
        tm: State<'_, SharedTaskManager>,
        task_id: TaskId,
    ) -> Result<(), String> {
        let mut mgr = tm.lock().await;
        mgr.cancel_task(&task_id);
        mgr.update_record(&task_id, |r| {
            r.status = TaskStatus::Cancelled;
        });
        Ok(())
    }

    #[tauri::command]
    async fn pause_task(
        tm: State<'_, SharedTaskManager>,
        task_id: TaskId,
    ) -> Result<(), String> {
        let mut mgr = tm.lock().await;
        mgr.cancel_task(&task_id);
        mgr.update_record(&task_id, |r| {
            r.status = TaskStatus::Paused;
        });
        Ok(())
    }

    #[tauri::command]
    async fn delete_task(
        tm: State<'_, SharedTaskManager>,
        task_id: TaskId,
    ) -> Result<(), String> {
        tm.lock().await.remove_task(&task_id);
        Ok(())
    }

    #[tauri::command]
    async fn load_persisted_tasks(
        tm: State<'_, SharedTaskManager>,
    ) -> Result<Vec<TaskRecord>, String> {
        let base_dir = {
            let mgr = tm.lock().await;
            mgr.base_dir.clone()
        };
        let tasks = crate::task_manager::db::load_all_tasks(&base_dir)
            .await
            .map_err(|e| e.to_string())?;
        {
            let mut mgr = tm.lock().await;
            for t in &tasks {
                if !mgr.handles.contains_key(&t.id) {
                    let cancel = Arc::new(Notify::new());
                    mgr.upsert(t.clone(), cancel);
                }
            }
        }
        Ok(tasks)
    }

    // ── Legacy shim commands (keep old frontend working) ──────────────────────

    #[tauri::command]
    async fn start_scan(
        app: AppHandle,
        tm: State<'_, SharedTaskManager>,
        options: Option<crate::downloader::ScanOptions>,
    ) -> Result<(), String> {
        create_scan_task(app, tm, options).await.map(|_| ())
    }

    #[tauri::command]
    async fn download_selected(
        app: AppHandle,
        tm: State<'_, SharedTaskManager>,
        selected: Vec<crate::models::BookCandidate>,
    ) -> Result<(), String> {
        let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
        let task_id = TaskManager::new_task_id();
        let cancel = Arc::new(Notify::new());
        let n = selected.len();
        let label = TaskManager::make_label(&TaskKind::SelectedDownload, "");
        let record = TaskRecord {
            id: task_id.clone(), kind: TaskKind::SelectedDownload,
            status: TaskStatus::Downloading, label,
            created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            finished_at: None, total: n, completed: 0,
            success_count: 0, error_count: 0,
            scan_items: vec![], scan_stats: None, stats: None, error_message: None,
        };
        {
            let mut mgr = tm.lock().await;
            mgr.upsert(record, cancel.clone());
        }
        let cancel_clone = cancel.clone();
        spawn_task_worker(app, tm.inner().clone(), task_id, move |tx| async move {
            crate::downloader::run_download_selected(cfg, selected, tx, cancel_clone).await
        }).await;
        Ok(())
    }

    #[tauri::command]
    async fn start_download(
        app: AppHandle,
        tm: State<'_, SharedTaskManager>,
    ) -> Result<(), String> {
        create_batch_download_task(app, tm, None).await.map(|_| ())
    }

    #[tauri::command]
    async fn stop_download(tm: State<'_, SharedTaskManager>) -> Result<(), String> {
        let mgr = tm.lock().await;
        for h in mgr.handles.values() {
            if matches!(h.record.status, TaskStatus::Scanning | TaskStatus::Downloading) {
                h.cancel.notify_waiters();
            }
        }
        Ok(())
    }

    #[tauri::command]
    async fn download_single(
        app: AppHandle,
        tm: State<'_, SharedTaskManager>,
        url: String,
    ) -> Result<(), String> {
        create_single_download_task(app, tm, url).await.map(|_| ())
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
        let task_manager: SharedTaskManager = {
            let base_dir = crate::config::load_config()
                .map(|c| std::path::PathBuf::from(&c.paths.base_dir))
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            Arc::new(Mutex::new(TaskManager::new(base_dir)))
        };

        tauri::Builder::default()
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_fs::init())
            .manage(task_manager)
            .invoke_handler(tauri::generate_handler![
                load_config,
                save_config,
                // New task manager commands
                create_scan_task,
                create_batch_download_task,
                create_single_download_task,
                confirm_task_download,
                list_tasks,
                get_task,
                cancel_task,
                pause_task,
                delete_task,
                load_persisted_tasks,
                // Legacy shim commands
                start_scan,
                download_selected,
                start_download,
                stop_download,
                download_single,
                // Other
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

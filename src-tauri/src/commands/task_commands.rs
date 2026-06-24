use super::worker::{app_data_dir, spawn_task_worker};
use crate::models::{
    BookCandidate, TaskId, TaskKind, TaskPreviewDraft, TaskRecord, TaskRetryContext, TaskStatus,
};
use crate::task_manager::{SharedTaskManager, TaskManager};
use std::collections::HashSet;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::sync::Notify;

// ── New Task Manager Commands ─────────────────────────────────────────────────

#[tauri::command]
pub async fn create_scan_task(
    app: AppHandle,
    tm: State<'_, SharedTaskManager>,
    options: Option<crate::downloader::ScanOptions>,
) -> Result<TaskId, String> {
    let cfg = {
        let dir = app_data_dir(&app);
        tokio::task::spawn_blocking(move || crate::config_db::load_config(&dir))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?
    };
    let task_id = TaskManager::new_task_id();
    let cancel = Arc::new(Notify::new());
    let label = TaskManager::make_label(&TaskKind::FullScan, "");
    let record = TaskRecord {
        id: task_id.clone(),
        kind: TaskKind::FullScan,
        status: TaskStatus::Scanning,
        label,
        source_url: None,
        retry_context: Some(TaskRetryContext {
            scan_options: Some(options.clone().unwrap_or_default()),
            selected_items: None,
        }),
        preview_draft: None,
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        finished_at: None,
        total: 0,
        completed: 0,
        success_count: 0,
        error_count: 0,
        scan_items: vec![],
        scan_stats: None,
        stats: None,
        error_message: None,
    };
    {
        let mut mgr = tm.lock().await;
        mgr.upsert(record, cancel.clone());
    }
    let opts = options.unwrap_or_default();
    let cancel_clone = cancel.clone();
    spawn_task_worker(
        app,
        tm.inner().clone(),
        task_id.clone(),
        move |tx| async move {
            crate::downloader::run_scan_with_options(cfg, opts, tx, cancel_clone).await
        },
    )
    .await;
    Ok(task_id)
}

#[tauri::command]
pub async fn create_batch_download_task(
    app: AppHandle,
    tm: State<'_, SharedTaskManager>,
    options: Option<crate::downloader::ScanOptions>,
) -> Result<TaskId, String> {
    let cfg = {
        let dir = app_data_dir(&app);
        tokio::task::spawn_blocking(move || crate::config_db::load_config(&dir))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?
    };
    let task_id = TaskManager::new_task_id();
    let cancel = Arc::new(Notify::new());
    let label = TaskManager::make_label(&TaskKind::BatchDownload, "");
    let record = TaskRecord {
        id: task_id.clone(),
        kind: TaskKind::BatchDownload,
        status: TaskStatus::Scanning,
        label,
        source_url: None,
        retry_context: Some(TaskRetryContext {
            scan_options: Some(options.clone().unwrap_or_default()),
            selected_items: None,
        }),
        preview_draft: None,
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        finished_at: None,
        total: 0,
        completed: 0,
        success_count: 0,
        error_count: 0,
        scan_items: vec![],
        scan_stats: None,
        stats: None,
        error_message: None,
    };
    {
        let mut mgr = tm.lock().await;
        mgr.upsert(record, cancel.clone());
    }
    let opts = options.unwrap_or_default();
    let cancel_clone = cancel.clone();
    spawn_task_worker(
        app,
        tm.inner().clone(),
        task_id.clone(),
        move |tx| async move {
            let mut cfg2 = cfg;
            if let Some(ref sites) = opts.enabled_sites {
                if !sites.is_empty() {
                    let enabled_sites: HashSet<&str> = sites.iter().map(String::as_str).collect();
                    for s in cfg2.websites.values_mut() {
                        if !enabled_sites.contains(s.domain_name.as_str()) {
                            s.enabled = false;
                        }
                    }
                }
            }
            crate::downloader::run_download(cfg2, tx, cancel_clone).await
        },
    )
    .await;
    Ok(task_id)
}

#[tauri::command]
pub async fn create_single_download_task(
    app: AppHandle,
    tm: State<'_, SharedTaskManager>,
    url: String,
) -> Result<TaskId, String> {
    let cfg = {
        let dir = app_data_dir(&app);
        tokio::task::spawn_blocking(move || crate::config_db::load_config(&dir))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?
    };
    let task_id = TaskManager::new_task_id();
    let cancel = Arc::new(Notify::new());
    let url_label = url
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or("单本")
        .to_string();
    let label = TaskManager::make_label(&TaskKind::SingleDownload, &url_label);
    let record = TaskRecord {
        id: task_id.clone(),
        kind: TaskKind::SingleDownload,
        status: TaskStatus::Downloading,
        label,
        source_url: Some(url.clone()),
        retry_context: None,
        preview_draft: None,
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        finished_at: None,
        total: 1,
        completed: 0,
        success_count: 0,
        error_count: 0,
        scan_items: vec![],
        scan_stats: None,
        stats: None,
        error_message: None,
    };
    {
        let mut mgr = tm.lock().await;
        mgr.upsert(record, cancel.clone());
    }
    let cancel_clone = cancel.clone();
    spawn_task_worker(
        app,
        tm.inner().clone(),
        task_id.clone(),
        move |tx| async move {
            crate::single_downloader::download_single_novel(cfg, url, tx, cancel_clone).await
        },
    )
    .await;
    Ok(task_id)
}

#[tauri::command]
pub async fn confirm_task_download(
    app: AppHandle,
    tm: State<'_, SharedTaskManager>,
    task_id: TaskId,
    selected: Vec<BookCandidate>,
) -> Result<(), String> {
    let cfg = {
        let dir = app_data_dir(&app);
        tokio::task::spawn_blocking(move || crate::config_db::load_config(&dir))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?
    };
    let cancel = Arc::new(Notify::new());
    let n = selected.len();
    {
        let mut mgr = tm.lock().await;
        mgr.update_record(&task_id, |r| {
            r.kind = TaskKind::SelectedDownload;
            r.status = TaskStatus::Downloading;
            r.total = n;
            r.retry_context = Some(TaskRetryContext {
                scan_options: r.retry_context.as_ref().and_then(|ctx| ctx.scan_options.clone()),
                selected_items: Some(selected.clone()),
            });
            r.preview_draft = None;
        });
        // Notify the old cancel handle (scan worker) before replacing it,
        // so any still-running scan is signalled to stop.
        if let Some(h) = mgr.handles.get(&task_id) {
            h.cancel.notify_waiters();
        }
        if let Some(h) = mgr.handles.get_mut(&task_id) {
            h.cancel = cancel.clone();
        }
    }
    let tid = task_id.clone();
    let cancel_clone = cancel.clone();
    spawn_task_worker(app, tm.inner().clone(), tid, move |tx| async move {
        crate::downloader::run_download_selected(cfg, selected, tx, cancel_clone).await
    })
    .await;
    Ok(())
}

#[tauri::command]
pub async fn create_selected_download_task(
    app: AppHandle,
    tm: State<'_, SharedTaskManager>,
    selected: Vec<BookCandidate>,
) -> Result<TaskId, String> {
    let cfg = {
        let dir = app_data_dir(&app);
        tokio::task::spawn_blocking(move || crate::config_db::load_config(&dir))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?
    };
    let task_id = TaskManager::new_task_id();
    let cancel = Arc::new(Notify::new());
    let n = selected.len();
    let label = TaskManager::make_label(&TaskKind::SelectedDownload, "");
    let record = TaskRecord {
        id: task_id.clone(),
        kind: TaskKind::SelectedDownload,
        status: TaskStatus::Downloading,
        label,
        source_url: None,
        retry_context: Some(TaskRetryContext {
            scan_options: None,
            selected_items: Some(selected.clone()),
        }),
        preview_draft: None,
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        finished_at: None,
        total: n,
        completed: 0,
        success_count: 0,
        error_count: 0,
        scan_items: vec![],
        scan_stats: None,
        stats: None,
        error_message: None,
    };
    {
        let mut mgr = tm.lock().await;
        mgr.upsert(record, cancel.clone());
    }
    let cancel_clone = cancel.clone();
    spawn_task_worker(
        app,
        tm.inner().clone(),
        task_id.clone(),
        move |tx| async move {
            crate::downloader::run_download_selected(cfg, selected, tx, cancel_clone).await
        },
    )
    .await;
    Ok(task_id)
}

#[tauri::command]
pub async fn list_tasks(tm: State<'_, SharedTaskManager>) -> Result<Vec<TaskRecord>, String> {
    Ok(tm.lock().await.list_records())
}

#[tauri::command]
pub async fn get_task(
    tm: State<'_, SharedTaskManager>,
    task_id: TaskId,
) -> Result<Option<TaskRecord>, String> {
    Ok(tm.lock().await.get_record(&task_id).cloned())
}

#[tauri::command]
pub async fn update_task_preview_draft(
    tm: State<'_, SharedTaskManager>,
    task_id: TaskId,
    draft: TaskPreviewDraft,
) -> Result<(), String> {
    let (base_dir, snapshot) = {
        let mut mgr = tm.lock().await;
        mgr.update_record(&task_id, |r| {
            r.preview_draft = Some(draft.clone());
        });
        (mgr.base_dir.clone(), mgr.get_record(&task_id).cloned())
    };
    if let Some(record) = snapshot {
        crate::task_manager::db::save_task(&base_dir, &record)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn cancel_task(tm: State<'_, SharedTaskManager>, task_id: TaskId) -> Result<(), String> {
    let (base_dir, snapshot) = {
        let mut mgr = tm.lock().await;
        mgr.cancel_task(&task_id);
        mgr.update_record(&task_id, |r| {
            r.status = TaskStatus::Cancelled;
            r.finished_at = Some(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
        });
        (mgr.base_dir.clone(), mgr.get_record(&task_id).cloned())
    };
    if let Some(record) = snapshot {
        crate::task_manager::db::save_task(&base_dir, &record)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn pause_task(tm: State<'_, SharedTaskManager>, task_id: TaskId) -> Result<(), String> {
    let (base_dir, snapshot) = {
        let mut mgr = tm.lock().await;
        mgr.cancel_task(&task_id);
        mgr.update_record(&task_id, |r| {
            r.status = TaskStatus::Paused;
        });
        (mgr.base_dir.clone(), mgr.get_record(&task_id).cloned())
    };
    if let Some(record) = snapshot {
        crate::task_manager::db::save_task(&base_dir, &record)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_task(tm: State<'_, SharedTaskManager>, task_id: TaskId) -> Result<(), String> {
    let base_dir = {
        let mut mgr = tm.lock().await;
        let base_dir = mgr.base_dir.clone();
        mgr.remove_task(&task_id);
        base_dir
    };
    crate::task_manager::db::delete_task(&base_dir, &task_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn load_persisted_tasks(
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

#[tauri::command]
pub async fn cancel_active_tasks(tm: State<'_, SharedTaskManager>) -> Result<(), String> {
    let (base_dir, snapshots) = {
        let mut mgr = tm.lock().await;
        let active_ids: Vec<_> = mgr
            .handles
            .iter()
            .filter_map(|(id, h)| {
                matches!(
                    h.record.status,
                    TaskStatus::Scanning | TaskStatus::Downloading
                )
                .then(|| id.clone())
            })
            .collect();
        let mut snapshots = Vec::new();
        for id in active_ids {
            if let Some(h) = mgr.handles.get(&id) {
                h.cancel.notify_waiters();
            }
            mgr.update_record(&id, |r| {
                r.status = TaskStatus::Cancelled;
                r.finished_at = Some(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
            });
            if let Some(record) = mgr.get_record(&id).cloned() {
                snapshots.push(record);
            }
        }
        (mgr.base_dir.clone(), snapshots)
    };
    for record in snapshots {
        crate::task_manager::db::save_task(&base_dir, &record)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

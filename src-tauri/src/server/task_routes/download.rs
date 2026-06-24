use axum::extract::{Path as AxumPath, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::json;
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::Notify;

use super::scan::ScanTaskBody;
use crate::models::{
    BookCandidate, TaskId, TaskKind, TaskPreviewDraft, TaskRecord, TaskRetryContext, TaskStatus,
};
use crate::server::state::AppState;
use crate::task_manager::{TaskManager, SharedTaskManager};

async fn persist_task_snapshot(
    task_manager: &SharedTaskManager,
    task_id: &str,
    base_dir: &std::path::Path,
) {
    let snapshot = {
        let mgr = task_manager.lock().await;
        mgr.get_record(task_id).cloned()
    };
    if let Some(record) = snapshot {
        let _ = crate::task_manager::db::save_task(base_dir, &record).await;
    }
}

async fn mark_task_failed(
    task_manager: &SharedTaskManager,
    task_id: &str,
    base_dir: &std::path::Path,
    error_message: String,
) {
    let snapshot = {
        let mut mgr = task_manager.lock().await;
        let mut next_snapshot: Option<TaskRecord> = None;
        mgr.update_record(task_id, |record| {
            if matches!(record.status, TaskStatus::Cancelled | TaskStatus::Paused | TaskStatus::Done) {
                return;
            }
            record.status = TaskStatus::Failed;
            record.error_message = Some(error_message.clone());
            record.finished_at = Some(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
            next_snapshot = Some(record.clone());
        });
        next_snapshot
    };

    if let Some(record) = snapshot {
        let _ = crate::task_manager::db::save_task(base_dir, &record).await;
    }
}

// ─── POST /api/tasks/batch ────────────────────────────────────────────────────

pub async fn post_batch_task(
    State(state): State<AppState>,
    Json(body): Json<ScanTaskBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let mut cfg = super::load_cfg(&state)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
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
            scan_options: Some(crate::downloader::ScanOptions {
                target_date: body.target_date.clone(),
                enabled_sites: body.enabled_sites.clone(),
                download_mode: body.download_mode.clone(),
            }),
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
    state
        .task_manager
        .lock()
        .await
        .upsert(record, cancel.clone());

    if let Some(ref sites) = body.enabled_sites {
        if !sites.is_empty() {
            let enabled_sites: HashSet<&str> = sites.iter().map(String::as_str).collect();
            for s in cfg.websites.values_mut() {
                if !enabled_sites.contains(s.domain_name.as_str()) {
                    s.enabled = false;
                }
            }
        }
    }

    let cancel_clone = cancel.clone();
    let tm = state.task_manager.clone();
    let tid = task_id.clone();
    let base_dir = state.base_dir.clone();

    tokio::spawn(async move {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<crate::models::ProgressEvent>(512);
        let tm2 = tm.clone();
        let tid2 = tid.clone();
        let base_dir_for_events = base_dir.clone();
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                match &event {
                    crate::models::ProgressEvent::FilterDone { stats } => {
                        let n = stats.final_download;
                        let s = stats.clone();
                        let mut mgr = tm2.lock().await;
                        mgr.update_record(&tid2, |r| {
                            r.total = n;
                            r.stats = Some(s);
                            r.status = TaskStatus::Downloading;
                        });
                    }
                    crate::models::ProgressEvent::OverallDone => {
                        {
                            let mut mgr = tm2.lock().await;
                            mgr.update_record(&tid2, |r| {
                                r.status = TaskStatus::Done;
                                r.finished_at = Some(
                                    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                                );
                                r.error_message = None;
                            });
                        }
                        persist_task_snapshot(&tm2, &tid2, &base_dir_for_events).await;
                    }
                    crate::models::ProgressEvent::NovelDone { .. } => {
                        let mut mgr = tm2.lock().await;
                        mgr.update_record(&tid2, |r| {
                            r.completed += 1;
                            r.success_count += 1;
                        });
                    }
                    crate::models::ProgressEvent::NovelError { message, .. } => {
                        let error_message = message.clone();
                        let mut mgr = tm2.lock().await;
                        mgr.update_record(&tid2, |r| {
                            r.completed += 1;
                            r.error_count += 1;
                            r.error_message = Some(error_message);
                        });
                    }
                    _ => {}
                }
            }
        });
        if let Err(error) = crate::downloader::run_download(cfg, tx, cancel_clone).await {
            mark_task_failed(&tm, &tid, &base_dir, error.to_string()).await;
        }
    });

    Ok(Json(json!({ "task_id": task_id })))
}

// ─── POST /api/tasks/single ───────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct SingleTaskBody {
    pub url: String,
}

pub async fn post_single_task(
    State(state): State<AppState>,
    Json(body): Json<SingleTaskBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let cfg = super::load_cfg(&state)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    let task_id = TaskManager::new_task_id();
    let cancel = Arc::new(Notify::new());
    let url_label = body
        .url
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
        source_url: Some(body.url.clone()),
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
    state
        .task_manager
        .lock()
        .await
        .upsert(record, cancel.clone());

    let url = body.url.clone();
    let cancel_clone = cancel.clone();
    let tm = state.task_manager.clone();
    let tid = task_id.clone();
    let base_dir = state.base_dir.clone();

    tokio::spawn(async move {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<crate::models::ProgressEvent>(512);
        let tm2 = tm.clone();
        let tid2 = tid.clone();
        let base_dir_for_events = base_dir.clone();
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                match &event {
                    crate::models::ProgressEvent::OverallDone => {
                        {
                            let mut mgr = tm2.lock().await;
                            mgr.update_record(&tid2, |r| {
                                r.status = TaskStatus::Done;
                                r.success_count += 1;
                                r.finished_at = Some(
                                    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                                );
                                r.error_message = None;
                            });
                        }
                        persist_task_snapshot(&tm2, &tid2, &base_dir_for_events).await;
                    }
                    crate::models::ProgressEvent::NovelError { message, .. } => {
                        let error_message = message.clone();
                        let mut mgr = tm2.lock().await;
                        mgr.update_record(&tid2, |r| {
                            r.status = TaskStatus::Failed;
                            r.error_count += 1;
                            r.error_message = Some(error_message);
                        });
                    }
                    _ => {}
                }
            }
        });
        if let Err(error) = crate::single_downloader::download_single_novel(cfg, url, tx, cancel_clone).await {
            mark_task_failed(&tm, &tid, &base_dir, error.to_string()).await;
        }
    });

    Ok(Json(json!({ "task_id": task_id })))
}

// ─── POST /api/tasks/:id/confirm ──────────────────────────────────────────────

pub async fn post_selected_task(
    State(state): State<AppState>,
    Json(selected): Json<Vec<BookCandidate>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let cfg = super::load_cfg(&state)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
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
    state
        .task_manager
        .lock()
        .await
        .upsert(record, cancel.clone());

    let cancel_clone = cancel.clone();
    let tm = state.task_manager.clone();
    let tid = task_id.clone();
    let base_dir = state.base_dir.clone();

    tokio::spawn(async move {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<crate::models::ProgressEvent>(512);
        let tm2 = tm.clone();
        let tid2 = tid.clone();
        let base_dir_for_events = base_dir.clone();
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                match &event {
                    crate::models::ProgressEvent::OverallDone => {
                        {
                            let mut mgr = tm2.lock().await;
                            mgr.update_record(&tid2, |r| {
                                r.status = TaskStatus::Done;
                                r.finished_at = Some(
                                    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                                );
                                r.error_message = None;
                            });
                        }
                        persist_task_snapshot(&tm2, &tid2, &base_dir_for_events).await;
                    }
                    crate::models::ProgressEvent::NovelDone { .. } => {
                        let mut mgr = tm2.lock().await;
                        mgr.update_record(&tid2, |r| {
                            r.completed += 1;
                            r.success_count += 1;
                        });
                    }
                    crate::models::ProgressEvent::NovelError { message, .. } => {
                        let error_message = message.clone();
                        let mut mgr = tm2.lock().await;
                        mgr.update_record(&tid2, |r| {
                            r.completed += 1;
                            r.error_count += 1;
                            r.error_message = Some(error_message);
                        });
                    }
                    _ => {}
                }
            }
        });
        if let Err(error) =
            crate::downloader::run_download_selected(cfg, selected, tx, cancel_clone).await
        {
            mark_task_failed(&tm, &tid, &base_dir, error.to_string()).await;
        }
    });

    Ok(Json(json!({ "task_id": task_id })))
}

pub async fn post_confirm_task(
    State(state): State<AppState>,
    AxumPath(task_id): AxumPath<TaskId>,
    Json(selected): Json<Vec<BookCandidate>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let cfg = super::load_cfg(&state)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    let cancel = Arc::new(Notify::new());
    let n = selected.len();
    {
        let mut mgr = state.task_manager.lock().await;
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
        if let Some(h) = mgr.handles.get_mut(&task_id) {
            h.cancel = cancel.clone();
        }
    }

    let tid = task_id.clone();
    let cancel_clone = cancel.clone();
    let tm = state.task_manager.clone();
    let base_dir = state.base_dir.clone();

    tokio::spawn(async move {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<crate::models::ProgressEvent>(512);
        let tm2 = tm.clone();
        let tid2 = tid.clone();
        let base_dir_for_events = base_dir.clone();
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                match &event {
                    crate::models::ProgressEvent::OverallDone => {
                        {
                            let mut mgr = tm2.lock().await;
                            mgr.update_record(&tid2, |r| {
                                r.status = TaskStatus::Done;
                                r.finished_at = Some(
                                    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                                );
                                r.error_message = None;
                            });
                        }
                        persist_task_snapshot(&tm2, &tid2, &base_dir_for_events).await;
                    }
                    crate::models::ProgressEvent::NovelDone { .. } => {
                        let mut mgr = tm2.lock().await;
                        mgr.update_record(&tid2, |r| {
                            r.completed += 1;
                            r.success_count += 1;
                        });
                    }
                    crate::models::ProgressEvent::NovelError { message, .. } => {
                        let error_message = message.clone();
                        let mut mgr = tm2.lock().await;
                        mgr.update_record(&tid2, |r| {
                            r.completed += 1;
                            r.error_count += 1;
                            r.error_message = Some(error_message);
                        });
                    }
                    _ => {}
                }
            }
        });
        if let Err(error) = crate::downloader::run_download_selected(cfg, selected, tx, cancel_clone).await {
            mark_task_failed(&tm, &tid, &base_dir, error.to_string()).await;
        }
    });

    Ok(Json(json!({ "ok": true })))
}

pub async fn post_update_task_preview_draft(
    State(state): State<AppState>,
    AxumPath(task_id): AxumPath<TaskId>,
    Json(draft): Json<TaskPreviewDraft>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let snapshot = {
        let mut mgr = state.task_manager.lock().await;
        mgr.update_record(&task_id, |r| {
            r.preview_draft = Some(draft.clone());
        });
        mgr.get_record(&task_id).cloned()
    };

    if let Some(record) = snapshot {
        let _ = crate::task_manager::db::save_task(&state.base_dir, &record).await;
        return Ok(Json(json!({ "ok": true })));
    }

    Err((StatusCode::NOT_FOUND, "task not found".to_string()))
}

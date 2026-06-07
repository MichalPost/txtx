use std::sync::Arc;
use axum::extract::{Path as AxumPath, State};
use axum::Json;
use axum::http::StatusCode;
use serde::Deserialize;
use serde_json::json;
use tokio::sync::Notify;

use crate::models::{BookCandidate, TaskId, TaskKind, TaskRecord, TaskStatus};
use crate::task_manager::TaskManager;
use crate::server::state::AppState;
use super::scan::ScanTaskBody;

// ─── POST /api/tasks/batch ────────────────────────────────────────────────────

pub async fn post_batch_task(
    State(state): State<AppState>,
    Json(body): Json<ScanTaskBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let mut cfg = super::load_cfg(&state).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    let task_id = TaskManager::new_task_id();
    let cancel = Arc::new(Notify::new());
    let label = TaskManager::make_label(&TaskKind::BatchDownload, "");
    let record = TaskRecord {
        id: task_id.clone(),
        kind: TaskKind::BatchDownload,
        status: TaskStatus::Scanning,
        label,
        source_url: None,
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
    state.task_manager.lock().await.upsert(record, cancel.clone());

    if let Some(ref sites) = body.enabled_sites {
        if !sites.is_empty() {
            for s in cfg.websites.values_mut() {
                if !sites.contains(&s.domain_name) {
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
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                let mut mgr = tm2.lock().await;
                match &event {
                    crate::models::ProgressEvent::FilterDone { stats } => {
                        let n = stats.final_download;
                        let s = stats.clone();
                        mgr.update_record(&tid2, |r| {
                            r.total = n;
                            r.stats = Some(s);
                            r.status = TaskStatus::Downloading;
                        });
                    }
                    crate::models::ProgressEvent::OverallDone => {
                        mgr.update_record(&tid2, |r| {
                            r.status = TaskStatus::Done;
                            r.finished_at = Some(
                                chrono::Local::now()
                                    .format("%Y-%m-%d %H:%M:%S")
                                    .to_string(),
                            );
                        });
                        if let Some(rec) = mgr.get_record(&tid2).cloned() {
                            let _ = crate::task_manager::db::save_task(&base_dir, &rec).await;
                        }
                    }
                    crate::models::ProgressEvent::NovelDone { .. } => {
                        mgr.update_record(&tid2, |r| {
                            r.completed += 1;
                            r.success_count += 1;
                        });
                    }
                    crate::models::ProgressEvent::NovelError { .. } => {
                        mgr.update_record(&tid2, |r| {
                            r.completed += 1;
                            r.error_count += 1;
                        });
                    }
                    _ => {}
                }
            }
        });
        let _ = crate::downloader::run_download(cfg, tx, cancel_clone).await;
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
    let cfg = super::load_cfg(&state).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
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
    state.task_manager.lock().await.upsert(record, cancel.clone());

    let url = body.url.clone();
    let cancel_clone = cancel.clone();
    let tm = state.task_manager.clone();
    let tid = task_id.clone();
    let base_dir = state.base_dir.clone();

    tokio::spawn(async move {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<crate::models::ProgressEvent>(512);
        let tm2 = tm.clone();
        let tid2 = tid.clone();
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                let mut mgr = tm2.lock().await;
                match &event {
                    crate::models::ProgressEvent::OverallDone => {
                        mgr.update_record(&tid2, |r| {
                            r.status = TaskStatus::Done;
                            r.success_count += 1;
                            r.finished_at = Some(
                                chrono::Local::now()
                                    .format("%Y-%m-%d %H:%M:%S")
                                    .to_string(),
                            );
                        });
                        if let Some(rec) = mgr.get_record(&tid2).cloned() {
                            let _ = crate::task_manager::db::save_task(&base_dir, &rec).await;
                        }
                    }
                    crate::models::ProgressEvent::NovelError { .. } => {
                        mgr.update_record(&tid2, |r| {
                            r.status = TaskStatus::Failed;
                            r.error_count += 1;
                        });
                    }
                    _ => {}
                }
            }
        });
        let _ = crate::single_downloader::download_single_novel(cfg, url, tx, cancel_clone).await;
    });

    Ok(Json(json!({ "task_id": task_id })))
}

// ─── POST /api/tasks/:id/confirm ──────────────────────────────────────────────

pub async fn post_confirm_task(
    State(state): State<AppState>,
    AxumPath(task_id): AxumPath<TaskId>,
    Json(selected): Json<Vec<BookCandidate>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let cfg = super::load_cfg(&state).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    let cancel = Arc::new(Notify::new());
    let n = selected.len();
    {
        let mut mgr = state.task_manager.lock().await;
        mgr.update_record(&task_id, |r| {
            r.kind = TaskKind::SelectedDownload;
            r.status = TaskStatus::Downloading;
            r.total = n;
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
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                let mut mgr = tm2.lock().await;
                match &event {
                    crate::models::ProgressEvent::OverallDone => {
                        mgr.update_record(&tid2, |r| {
                            r.status = TaskStatus::Done;
                            r.finished_at = Some(
                                chrono::Local::now()
                                    .format("%Y-%m-%d %H:%M:%S")
                                    .to_string(),
                            );
                        });
                        if let Some(rec) = mgr.get_record(&tid2).cloned() {
                            let _ = crate::task_manager::db::save_task(&base_dir, &rec).await;
                        }
                    }
                    crate::models::ProgressEvent::NovelDone { .. } => {
                        mgr.update_record(&tid2, |r| {
                            r.completed += 1;
                            r.success_count += 1;
                        });
                    }
                    crate::models::ProgressEvent::NovelError { .. } => {
                        mgr.update_record(&tid2, |r| {
                            r.completed += 1;
                            r.error_count += 1;
                        });
                    }
                    _ => {}
                }
            }
        });
        let _ = crate::downloader::run_download_selected(cfg, selected, tx, cancel_clone).await;
    });

    Ok(Json(json!({ "ok": true })))
}

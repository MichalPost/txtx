use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::Notify;

use crate::downloader::ScanOptions;
use crate::models::{TaskKind, TaskRecord, TaskRetryContext, TaskStatus};
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

// ─── POST /api/tasks/scan ─────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ScanTaskBody {
    pub target_date: Option<String>,
    pub enabled_sites: Option<Vec<String>>,
    pub download_mode: Option<String>,
}

pub async fn post_scan_task(
    State(state): State<AppState>,
    Json(body): Json<ScanTaskBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let cfg = super::load_cfg(&state)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
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
            scan_options: Some(ScanOptions {
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

    let opts = ScanOptions {
        target_date: body.target_date,
        enabled_sites: body.enabled_sites,
        download_mode: body.download_mode,
    };
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
                    crate::models::ProgressEvent::ScanComplete { items, stats } => {
                        let items2 = items.clone();
                        let stats2 = stats.clone();
                        let mut mgr = tm2.lock().await;
                        mgr.update_record(&tid2, |r| {
                            r.scan_items = items2;
                            r.scan_stats = Some(stats2);
                            r.status = TaskStatus::Preview;
                            r.error_message = None;
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

        if let Err(error) = crate::downloader::run_scan_with_options(cfg, opts, tx, cancel_clone).await {
            mark_task_failed(&tm, &tid, &base_dir, error.to_string()).await;
        }
    });

    Ok(Json(json!({ "task_id": task_id })))
}

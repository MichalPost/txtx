use std::sync::Arc;
use axum::extract::State;
use axum::Json;
use axum::http::StatusCode;
use serde::Deserialize;
use serde_json::json;
use tokio::sync::Notify;

use crate::models::{TaskKind, TaskRecord, TaskStatus};
use crate::task_manager::TaskManager;
use crate::downloader::ScanOptions;
use crate::server::state::AppState;

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
    let cfg = super::load_cfg(&state).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    let task_id = TaskManager::new_task_id();
    let cancel = Arc::new(Notify::new());
    let label = TaskManager::make_label(&TaskKind::FullScan, "");
    let record = TaskRecord {
        id: task_id.clone(),
        kind: TaskKind::FullScan,
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

    let opts = ScanOptions {
        target_date: body.target_date,
        enabled_sites: body.enabled_sites,
    };
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
                    crate::models::ProgressEvent::ScanComplete { items, stats } => {
                        let items2 = items.clone();
                        let stats2 = stats.clone();
                        mgr.update_record(&tid2, |r| {
                            r.scan_items = items2;
                            r.scan_stats = Some(stats2);
                            r.status = TaskStatus::Preview;
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

        let _ = crate::downloader::run_scan_with_options(cfg, opts, tx, cancel_clone).await;
    });

    Ok(Json(json!({ "task_id": task_id })))
}

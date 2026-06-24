use axum::http::StatusCode;
use axum::{
    extract::{Path as AxumPath, State},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

use crate::models::{TaskId, TaskRecord, TaskStatus};
use crate::server::state::AppState;

// ─── GET /api/tasks ────────────────────────────────────────────────────────────

pub async fn get_tasks(State(state): State<AppState>) -> Json<Vec<TaskRecord>> {
    Json(state.task_manager.lock().await.list_records())
}

// ─── GET /api/tasks/:id ────────────────────────────────────────────────────────

pub async fn get_task(
    State(state): State<AppState>,
    AxumPath(task_id): AxumPath<TaskId>,
) -> Response {
    match state
        .task_manager
        .lock()
        .await
        .get_record(&task_id)
        .cloned()
    {
        Some(r) => Json(r).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

// ─── POST /api/tasks/:id/cancel ───────────────────────────────────────────────

pub async fn post_cancel_task(
    State(state): State<AppState>,
    AxumPath(task_id): AxumPath<TaskId>,
) -> Json<serde_json::Value> {
    let (base_dir, snapshot) = {
        let mut mgr = state.task_manager.lock().await;
        mgr.cancel_task(&task_id);
        mgr.update_record(&task_id, |r| {
            r.status = TaskStatus::Cancelled;
            r.finished_at = Some(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
        });
        (mgr.base_dir.clone(), mgr.get_record(&task_id).cloned())
    };
    if let Some(record) = snapshot {
        let _ = crate::task_manager::db::save_task(&base_dir, &record).await;
    }
    Json(json!({ "ok": true }))
}

// ─── POST /api/tasks/:id/pause ────────────────────────────────────────────────

pub async fn post_pause_task(
    State(state): State<AppState>,
    AxumPath(task_id): AxumPath<TaskId>,
) -> Json<serde_json::Value> {
    let (base_dir, snapshot) = {
        let mut mgr = state.task_manager.lock().await;
        mgr.cancel_task(&task_id);
        mgr.update_record(&task_id, |r| {
            r.status = TaskStatus::Paused;
        });
        (mgr.base_dir.clone(), mgr.get_record(&task_id).cloned())
    };
    if let Some(record) = snapshot {
        let _ = crate::task_manager::db::save_task(&base_dir, &record).await;
    }
    Json(json!({ "ok": true }))
}

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────────

pub async fn delete_task(
    State(state): State<AppState>,
    AxumPath(task_id): AxumPath<TaskId>,
) -> Json<serde_json::Value> {
    let base_dir = {
        let mut mgr = state.task_manager.lock().await;
        let base_dir = mgr.base_dir.clone();
        mgr.remove_task(&task_id);
        base_dir
    };
    let _ = crate::task_manager::db::delete_task(&base_dir, &task_id).await;
    Json(json!({ "ok": true }))
}

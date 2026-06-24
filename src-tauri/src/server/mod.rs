pub mod ai_routes;
pub mod bookshelf_routes;
pub mod config_routes;
pub mod convert_routes;
pub mod download_routes;
pub mod error;
pub mod health_routes;
pub mod history_routes;
pub mod novel_routes;
pub mod queue_routes;
pub mod source_routes;
pub mod state;
pub mod task_routes;
pub mod tools_routes;

use axum::http::{HeaderValue, Method, Request, StatusCode};
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tokio::sync::{Mutex, Notify};
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::task_manager::{SharedTaskManager, TaskManager};
use ai_routes::{get_ai_config, post_ai_complete, post_ai_extract, post_ai_stream, put_ai_config};
use bookshelf_routes::{
    delete_book_route, get_books, get_calibre_detect, open_book_parent_route,
};
use config_routes::{get_config, put_config};
use convert_routes::post_convert_text;
use download_routes::{post_stop, ws_download, ws_download_selected, ws_scan, ws_single};
use health_routes::get_health;
use history_routes::{
    delete_history, get_history, get_history_page, get_history_site_options, get_history_stats,
};
use novel_routes::{get_novel_name, post_open_dir};
use queue_routes::{delete_queue, get_queue};
use source_routes::get_source;
use state::{AppState, DownloadState};
use task_routes::{
    delete_task as delete_task_route, get_task, get_tasks, post_batch_task, post_cancel_task,
    post_confirm_task, post_pause_task, post_scan_task, post_selected_task, post_single_task,
    post_update_task_preview_draft,
};
use tools_routes::{post_merge_files, post_split_file};

const ALLOWED_ORIGINS: &[&str] = &[
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "tauri://localhost",
];

fn is_allowed_origin(origin: &HeaderValue) -> bool {
    origin
        .to_str()
        .map(|value| ALLOWED_ORIGINS.contains(&value))
        .unwrap_or(false)
}

async fn reject_untrusted_origin(
    req: Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, StatusCode> {
    if let Some(origin) = req.headers().get(axum::http::header::ORIGIN) {
        if !is_allowed_origin(origin) {
            return Err(StatusCode::FORBIDDEN);
        }
    }
    Ok(next.run(req).await)
}

pub async fn run_server() -> anyhow::Result<()> {
    let port: u16 = std::env::var("TXTX_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3721);

    let download_state = Arc::new(Mutex::new(DownloadState {
        cancel: Arc::new(Notify::new()),
        running: false,
    }));

    let base_dir = dirs::data_local_dir()
        .map(|p| p.join("txtx"))
        .unwrap_or_else(|| {
            std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
        });

    // Task manager — read novel_threads from config for max_concurrent (mirrors Tauri mode)
    let max_concurrent = crate::config_db::load_config(&base_dir)
        .map(|cfg| cfg.concurrency.novel_threads.clamp(1, 5))
        .unwrap_or(3);
    let task_manager: SharedTaskManager = Arc::new(Mutex::new(TaskManager::new_with_max(
        base_dir.clone(),
        max_concurrent,
    )));

    let app_state = AppState {
        download: download_state,
        base_dir,
        task_manager,
    };

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(|origin, _| {
            is_allowed_origin(origin)
        }))
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([axum::http::header::CONTENT_TYPE]);

    let app = Router::new()
        .route("/api/config", get(get_config).put(put_config))
        .route("/api/scan", get(ws_scan))
        .route("/api/download", get(ws_download))
        .route("/api/download/single", get(ws_single))
        .route("/api/download/selected", get(ws_download_selected))
        .route("/api/stop", post(post_stop))
        .route("/api/history", get(get_history).delete(delete_history))
        .route("/api/history/page", get(get_history_page))
        .route("/api/history/sites", get(get_history_site_options))
        .route("/api/history/stats", get(get_history_stats))
        .route("/api/health", get(get_health))
        .route("/api/convert/text", post(post_convert_text))
        .route("/api/tools/merge", post(post_merge_files))
        .route("/api/tools/split", post(post_split_file))
        .route("/api/queue", get(get_queue).delete(delete_queue))
        .route("/api/novel-name", get(get_novel_name))
        .route("/api/open-dir", post(post_open_dir))
        .route("/api/source", get(get_source))
        .route("/api/ai/config", get(get_ai_config).put(put_ai_config))
        .route("/api/ai/complete", post(post_ai_complete))
        .route("/api/ai/stream", post(post_ai_stream))
        .route("/api/ai/extract", post(post_ai_extract))
        // ── Task manager routes ──────────────────────────────────────────────
        .route("/api/tasks", get(get_tasks))
        .route("/api/tasks/scan", post(post_scan_task))
        .route("/api/tasks/batch", post(post_batch_task))
        .route("/api/tasks/single", post(post_single_task))
        .route("/api/tasks/selected", post(post_selected_task))
        .route("/api/tasks/{id}", get(get_task).delete(delete_task_route))
        .route("/api/tasks/{id}/confirm", post(post_confirm_task))
        .route("/api/tasks/{id}/preview-draft", post(post_update_task_preview_draft))
        .route("/api/tasks/{id}/cancel", post(post_cancel_task))
        .route("/api/tasks/{id}/pause", post(post_pause_task))
        // ── Bookshelf routes ─────────────────────────────────────────────────
        .route("/api/books", get(get_books).delete(delete_book_route))
        .route("/api/books/open-parent", post(open_book_parent_route))
        .route("/api/calibre/detect", get(get_calibre_detect))
        .with_state(app_state)
        .layer(axum::middleware::from_fn(reject_untrusted_origin))
        .layer(cors);

    let addr = format!("127.0.0.1:{port}");
    tracing::info!("txtx-server listening on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

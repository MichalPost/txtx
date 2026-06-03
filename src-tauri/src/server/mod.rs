pub mod config_routes;
pub mod convert_routes;
pub mod download_routes;
pub mod error;
pub mod health_routes;
pub mod history_routes;
pub mod novel_routes;
pub mod queue_routes;
pub mod state;
pub mod ai_routes;

use std::sync::Arc;
use axum::{routing::{get, post}, Router};
use tokio::sync::{Mutex, Notify};
use tower_http::cors::{Any, CorsLayer};

use state::{AppState, DownloadState};
use config_routes::{get_config, put_config};
use download_routes::{post_stop, ws_download, ws_download_selected, ws_scan, ws_single};
use history_routes::{delete_history, get_history, get_history_page, get_history_stats};
use health_routes::get_health;
use convert_routes::post_convert_text;
use queue_routes::{delete_queue, get_queue};
use novel_routes::{get_novel_name, post_open_dir};
use ai_routes::{get_ai_config, put_ai_config, post_ai_complete, post_ai_stream, post_ai_extract};

pub async fn run_server() {
    let port: u16 = std::env::var("TXTX_PORT")
        .ok().and_then(|p| p.parse().ok()).unwrap_or(3721);

    let download_state = Arc::new(Mutex::new(DownloadState {
        cancel: Arc::new(Notify::new()),
        running: false,
    }));

    let base_dir = crate::config::load_config()
        .map(|c| std::path::PathBuf::from(&c.paths.base_dir))
        .unwrap_or_else(|_| std::path::PathBuf::from("."));

    let app_state = AppState { download: download_state, base_dir };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/config",              get(get_config).put(put_config))
        .route("/api/scan",                get(ws_scan))
        .route("/api/download",            get(ws_download))
        .route("/api/download/single",     get(ws_single))
        .route("/api/download/selected",   get(ws_download_selected))
        .route("/api/stop",                post(post_stop))
        .route("/api/history",             get(get_history).delete(delete_history))
        .route("/api/history/page",        get(get_history_page))
        .route("/api/history/stats",       get(get_history_stats))
        .route("/api/health",              get(get_health))
        .route("/api/convert/text",        post(post_convert_text))
        .route("/api/queue",               get(get_queue).delete(delete_queue))
        .route("/api/novel-name",          get(get_novel_name))
        .route("/api/open-dir",            post(post_open_dir))
        .route("/api/ai/config",           get(get_ai_config).put(put_ai_config))
        .route("/api/ai/complete",         post(post_ai_complete))
        .route("/api/ai/stream",           post(post_ai_stream))
        .route("/api/ai/extract",          post(post_ai_extract))
        .with_state(app_state)
        .layer(cors);

    let addr = format!("127.0.0.1:{port}");
    tracing::info!("txtx-server listening on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

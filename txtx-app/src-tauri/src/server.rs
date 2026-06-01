use std::sync::Arc;
use axum::{
    extract::{State, WebSocketUpgrade},
    extract::ws::{Message, WebSocket},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use tokio::sync::{mpsc, Mutex, Notify};
use tower_http::cors::{Any, CorsLayer};

use crate::config;
use crate::downloader;
use crate::models::{AppConfig, ProgressEvent};
use crate::models::BookCandidate;
use crate::downloader::ScanOptions;

// ─── Shared State ─────────────────────────────────────────────────────────────

struct DownloadState {
    cancel: Arc<Notify>,
    running: bool,
}
type SharedDownloadState = Arc<Mutex<DownloadState>>;

#[derive(Clone)]
struct AppState {
    download: SharedDownloadState,
}

// ─── Error helper ─────────────────────────────────────────────────────────────

struct AppError(anyhow::Error);
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (StatusCode::INTERNAL_SERVER_ERROR,
         Json(json!({ "error": self.0.to_string() }))).into_response()
    }
}
impl<E: Into<anyhow::Error>> From<E> for AppError {
    fn from(e: E) -> Self { AppError(e.into()) }
}

// ─── Config handlers ──────────────────────────────────────────────────────────

async fn get_config() -> Result<Json<AppConfig>, AppError> {
    Ok(Json(config::load_config()?))
}

async fn put_config(Json(cfg): Json<AppConfig>) -> Result<Json<serde_json::Value>, AppError> {
    config::save_config(&cfg)?;
    Ok(Json(json!({ "ok": true })))
}

// ─── Download handlers ────────────────────────────────────────────────────────

async fn post_stop(State(state): State<AppState>) -> Json<serde_json::Value> {
    state.download.lock().await.cancel.notify_waiters();
    Json(json!({ "ok": true }))
}

async fn ws_download(ws: WebSocketUpgrade, State(state): State<AppState>) -> Response {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(mut socket: WebSocket, state: AppState) {
    let mut guard = state.download.lock().await;
    if guard.running {
        let msg = serde_json::to_string(&ProgressEvent::Log {
            message: "下载已在运行中".into(), level: "error".into(),
        }).unwrap_or_default();
        let _ = socket.send(Message::Text(msg.into())).await;
        return;
    }

    let cfg = match config::load_config() {
        Ok(c) => c,
        Err(e) => {
            let msg = serde_json::to_string(&ProgressEvent::Log {
                message: format!("配置加载失败: {e}"), level: "error".into(),
            }).unwrap_or_default();
            let _ = socket.send(Message::Text(msg.into())).await;
            return;
        }
    };

    let cancel = Arc::new(Notify::new());
    guard.cancel = cancel.clone();
    guard.running = true;
    drop(guard);

    let (tx, mut rx) = mpsc::channel::<ProgressEvent>(256);
    let state_clone = state.download.clone();

    let cancel_clone = cancel.clone();
    tokio::spawn(async move {
        let _ = downloader::run_download(cfg, tx, cancel_clone).await;
        state_clone.lock().await.running = false;
    });

    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Some(ev) => {
                        let is_done = matches!(ev, ProgressEvent::OverallDone);
                        if let Ok(text) = serde_json::to_string(&ev) {
                            if socket.send(Message::Text(text.into())).await.is_err() { break; }
                        }
                        if is_done { break; }
                    }
                    None => break,
                }
            }
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(t))) if t.trim() == "stop" => {
                        cancel.notify_waiters();
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }
}

// ─── Single novel download (WebSocket) ───────────────────────────────────────

#[derive(Deserialize)]
struct SingleDownloadQuery {
    url: String,
}

async fn ws_single(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<SingleDownloadQuery>,
) -> Response {
    ws.on_upgrade(move |socket| handle_ws_single(socket, state, q.url))
}

async fn handle_ws_single(mut socket: WebSocket, state: AppState, url: String) {
    let mut guard = state.download.lock().await;
    if guard.running {
        let msg = serde_json::to_string(&ProgressEvent::Log {
            message: "下载已在运行中".into(), level: "error".into(),
        }).unwrap_or_default();
        let _ = socket.send(Message::Text(msg.into())).await;
        return;
    }

    let cfg = match config::load_config() {
        Ok(c) => c,
        Err(e) => {
            let msg = serde_json::to_string(&ProgressEvent::Log {
                message: format!("配置加载失败: {e}"), level: "error".into(),
            }).unwrap_or_default();
            let _ = socket.send(Message::Text(msg.into())).await;
            return;
        }
    };

    let cancel = Arc::new(Notify::new());
    guard.cancel = cancel.clone();
    guard.running = true;
    drop(guard);

    let (tx, mut rx) = mpsc::channel::<ProgressEvent>(256);
    let state_clone = state.download.clone();

    let cancel_clone = cancel.clone();
    tokio::spawn(async move {
        let _ = crate::single_downloader::download_single_novel(cfg, url, tx, cancel_clone).await;
        state_clone.lock().await.running = false;
    });

    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Some(ev) => {
                        let is_done = matches!(ev, ProgressEvent::OverallDone);
                        if let Ok(text) = serde_json::to_string(&ev) {
                            if socket.send(Message::Text(text.into())).await.is_err() { break; }
                        }
                        if is_done { break; }
                    }
                    None => break,
                }
            }
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(t))) if t.trim() == "stop" => {
                        cancel.notify_waiters();
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }
}

// ─── History handlers ─────────────────────────────────────────────────────────

async fn get_history() -> Result<Json<Vec<crate::history::HistoryEntry>>, AppError> {
    let cfg = config::load_config()?;
    let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
    let entries = crate::history::load_history(&base_dir).await?;
    Ok(Json(entries))
}

async fn delete_history() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = config::load_config()?;
    let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
    crate::history::clear_history(&base_dir).await?;
    Ok(Json(json!({ "ok": true })))
}

// ─── Site health check ────────────────────────────────────────────────────────

async fn get_health() -> Result<Json<Vec<crate::models::SiteHealth>>, AppError> {
    let cfg = config::load_config()?;
    let results = crate::crawler::check_site_health(&cfg).await?;
    Ok(Json(results))
}

// ─── Text conversion ──────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ConvertRequest {
    path: String,
}

async fn post_convert_text(
    Json(req): Json<ConvertRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let p = std::path::PathBuf::from(&req.path);
    let text = tokio::fs::read_to_string(&p).await
        .map_err(|e| anyhow::anyhow!("读取文件失败: {}", e))?;
    let (converted, changed) = crate::text_converter::detect_and_convert(&text, true);
    if changed {
        tokio::fs::write(&p, converted.as_bytes()).await
            .map_err(|e| anyhow::anyhow!("写入文件失败: {}", e))?;
    }
    Ok(Json(json!({ "changed": changed, "path": req.path })))
}

// ─── Scan-only handler (WebSocket) ───────────────────────────────────────────

async fn ws_scan(ws: WebSocketUpgrade, State(state): State<AppState>) -> Response {
    ws.on_upgrade(move |socket| handle_ws_scan(socket, state))
}

async fn handle_ws_scan(mut socket: WebSocket, state: AppState) {
    let mut guard = state.download.lock().await;
    if guard.running {
        let msg = serde_json::to_string(&ProgressEvent::Log {
            message: "扫描/下载已在运行中".into(), level: "error".into(),
        }).unwrap_or_default();
        let _ = socket.send(Message::Text(msg.into())).await;
        return;
    }

    let cfg = match config::load_config() {
        Ok(c) => c,
        Err(e) => {
            let msg = serde_json::to_string(&ProgressEvent::Log {
                message: format!("配置加载失败: {e}"), level: "error".into(),
            }).unwrap_or_default();
            let _ = socket.send(Message::Text(msg.into())).await;
            return;
        }
    };

    // Optional first message: ScanOptions JSON
    let options: ScanOptions = {
        // Use a short timeout to check for an options message
        let maybe = tokio::time::timeout(
            std::time::Duration::from_millis(200),
            socket.recv()
        ).await;        match maybe {
            Ok(Some(Ok(Message::Text(t)))) => {
                serde_json::from_str(&t).unwrap_or_default()
            }
            _ => ScanOptions::default(),
        }
    };

    let cancel = Arc::new(Notify::new());
    guard.cancel = cancel.clone();
    guard.running = true;
    drop(guard);

    let (tx, mut rx) = mpsc::channel::<ProgressEvent>(256);
    let state_clone = state.download.clone();

    let cancel_clone = cancel.clone();
    tokio::spawn(async move {
        let _ = downloader::run_scan_with_options(cfg, options, tx, cancel_clone).await;
        state_clone.lock().await.running = false;
    });

    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Some(ev) => {
                        let is_done = matches!(ev, ProgressEvent::ScanComplete { .. });
                        if let Ok(text) = serde_json::to_string(&ev) {
                            if socket.send(Message::Text(text.into())).await.is_err() { break; }
                        }
                        if is_done { break; }
                    }
                    None => break,
                }
            }
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(t))) if t.trim() == "stop" => {
                        cancel.notify_waiters();
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }
}

// ─── Download selected novels (WebSocket) ────────────────────────────────────

async fn ws_download_selected(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_ws_download_selected(socket, state))
}

async fn handle_ws_download_selected(mut socket: WebSocket, state: AppState) {
    // First message must be JSON array of BookCandidate
    let selected: Vec<BookCandidate> = match socket.recv().await {
        Some(Ok(Message::Text(t))) => match serde_json::from_str(&t) {
            Ok(v) => v,
            Err(e) => {
                let msg = serde_json::to_string(&ProgressEvent::Log {
                    message: format!("无效的书单数据: {e}"), level: "error".into(),
                }).unwrap_or_default();
                let _ = socket.send(Message::Text(msg.into())).await;
                return;
            }
        },
        _ => return,
    };

    let mut guard = state.download.lock().await;
    if guard.running {
        let msg = serde_json::to_string(&ProgressEvent::Log {
            message: "下载已在运行中".into(), level: "error".into(),
        }).unwrap_or_default();
        let _ = socket.send(Message::Text(msg.into())).await;
        return;
    }

    let cfg = match config::load_config() {
        Ok(c) => c,
        Err(e) => {
            let msg = serde_json::to_string(&ProgressEvent::Log {
                message: format!("配置加载失败: {e}"), level: "error".into(),
            }).unwrap_or_default();
            let _ = socket.send(Message::Text(msg.into())).await;
            return;
        }
    };

    let cancel = Arc::new(Notify::new());
    guard.cancel = cancel.clone();
    guard.running = true;
    drop(guard);

    let (tx, mut rx) = mpsc::channel::<ProgressEvent>(256);
    let state_clone = state.download.clone();

    let cancel_clone = cancel.clone();
    tokio::spawn(async move {
        let _ = downloader::run_download_selected(cfg, selected, tx, cancel_clone).await;
        state_clone.lock().await.running = false;
    });

    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Some(ev) => {
                        let is_done = matches!(ev, ProgressEvent::OverallDone);
                        if let Ok(text) = serde_json::to_string(&ev) {
                            if socket.send(Message::Text(text.into())).await.is_err() { break; }
                        }
                        if is_done { break; }
                    }
                    None => break,
                }
            }
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(t))) if t.trim() == "stop" => {
                        cancel.notify_waiters();
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }
}

// ─── Queue handlers ───────────────────────────────────────────────────────────

async fn get_queue() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = config::load_config()?;
    let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
    let path = base_dir.join("download_queue.json");
    if !path.exists() {
        return Ok(Json(json!({ "exists": false })));
    }
    let data = tokio::fs::read_to_string(&path).await
        .map_err(|e| anyhow::anyhow!("读取队列失败: {}", e))?;
    let queue: serde_json::Value = serde_json::from_str(&data)
        .map_err(|e| anyhow::anyhow!("解析队列失败: {}", e))?;
    let item_count = queue["items"].as_array().map(|a| a.len()).unwrap_or(0);
    Ok(Json(json!({
        "exists": true,
        "created_at": queue["created_at"],
        "target_date": queue["target_date"],
        "item_count": item_count,
    })))
}

async fn delete_queue() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = config::load_config()?;
    let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
    let path = base_dir.join("download_queue.json");
    if path.exists() {
        tokio::fs::remove_file(&path).await
            .map_err(|e| anyhow::anyhow!("删除队列失败: {}", e))?;
    }
    Ok(Json(json!({ "ok": true })))
}

// ─── Novel name preview ───────────────────────────────────────────────────────

#[derive(Deserialize)]
struct NovelNameQuery {
    url: String,
}

async fn get_novel_name(
    axum::extract::Query(q): axum::extract::Query<NovelNameQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = config::load_config()?;
    let client = Arc::new(crate::crawler::build_client(&cfg.network)?);

    let site_cfg = cfg.websites.values()
        .find(|s| s.enabled && q.url.contains(&s.domain_name))
        .cloned();

    let xpath = site_cfg.as_ref().map(|s| s.novel_name_x.clone()).unwrap_or_default();

    if xpath.is_empty() {
        return Ok(Json(json!({ "name": null, "error": "未找到匹配站点配置" })));
    }

    match crate::crawler::fetch_novel_name(
        &client, &q.url, &xpath, &cfg.network.encoding_map,
        cfg.network.retry_count, cfg.network.retry_delay,
    ).await {
        Some(name) => Ok(Json(json!({ "name": name }))),
        None => Ok(Json(json!({ "name": null, "error": "无法获取书名" }))),
    }
}

// ─── Open output dir (noop in HTTP mode) ─────────────────────────────────────

async fn post_open_dir() -> Json<serde_json::Value> {
    // In HTTP/dev mode, opening directory is not supported.
    // Tauri mode handles this via the open_output_dir invoke command.
    Json(json!({ "ok": true }))
}

// ─── Router ───────────────────────────────────────────────────────────────────

pub async fn run_server() {
    let port: u16 = std::env::var("TXTX_PORT")
        .ok().and_then(|p| p.parse().ok()).unwrap_or(3721);

    let download_state: SharedDownloadState = Arc::new(Mutex::new(DownloadState {
        cancel: Arc::new(Notify::new()),
        running: false,
    }));

    let app_state = AppState { download: download_state };

    let cors = CorsLayer::new()
        .allow_origin(Any).allow_methods(Any).allow_headers(Any);

    let app = Router::new()
        .route("/api/config",  get(get_config).put(put_config))
        .route("/api/scan",    get(ws_scan))
        .route("/api/download", get(ws_download))
        .route("/api/download/single", get(ws_single))
        .route("/api/download/selected", get(ws_download_selected))
        .route("/api/stop",    post(post_stop))
        .route("/api/history", get(get_history).delete(delete_history))
        .route("/api/health",  get(get_health))
        .route("/api/convert/text", post(post_convert_text))
        .route("/api/queue", get(get_queue).delete(delete_queue))
        .route("/api/novel-name", get(get_novel_name))
        .route("/api/open-dir", post(post_open_dir))
        .with_state(app_state)
        .layer(cors);

    let addr = format!("127.0.0.1:{port}");
    println!("txtx-server listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

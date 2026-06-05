use std::sync::Arc;
use axum::{
    extract::{Query, State, WebSocketUpgrade},
    extract::ws::{Message, WebSocket},
    response::Response,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use tokio::sync::{mpsc, Notify};

use crate::downloader;
use crate::downloader::ScanOptions;
use crate::models::{BookCandidate, ProgressEvent};
use super::state::AppState;

// ─── Stop ─────────────────────────────────────────────────────────────────────

pub async fn post_stop(State(state): State<AppState>) -> Json<serde_json::Value> {
    state.download.lock().await.cancel.notify_waiters();
    Json(json!({ "ok": true }))
}

// ─── Full download (WebSocket) ────────────────────────────────────────────────

pub async fn ws_download(ws: WebSocketUpgrade, State(state): State<AppState>) -> Response {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(mut socket: WebSocket, state: AppState) {
    let mut guard = state.download.lock().await;
    if guard.running {
        send_error(&mut socket, "下载已在运行中").await;
        return;
    }

    let cfg = match crate::config_db::load_config(&state.base_dir) {
        Ok(c) => c,
        Err(e) => { send_error(&mut socket, &format!("配置加载失败: {e}")).await; return; }
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

    ws_event_loop(&mut socket, &mut rx, &cancel, |ev| matches!(ev, ProgressEvent::OverallDone)).await;
}

// ─── Single novel download (WebSocket) ───────────────────────────────────────

#[derive(Deserialize)]
pub struct SingleDownloadQuery {
    pub url: String,
}

pub async fn ws_single(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(q): Query<SingleDownloadQuery>,
) -> Response {
    ws.on_upgrade(move |socket| handle_ws_single(socket, state, q.url))
}

async fn handle_ws_single(mut socket: WebSocket, state: AppState, url: String) {
    let mut guard = state.download.lock().await;
    if guard.running {
        send_error(&mut socket, "下载已在运行中").await;
        return;
    }

    let cfg = match crate::config_db::load_config(&state.base_dir) {
        Ok(c) => c,
        Err(e) => { send_error(&mut socket, &format!("配置加载失败: {e}")).await; return; }
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

    ws_event_loop(&mut socket, &mut rx, &cancel, |ev| matches!(ev, ProgressEvent::OverallDone)).await;
}

// ─── Scan-only (WebSocket) ────────────────────────────────────────────────────

pub async fn ws_scan(ws: WebSocketUpgrade, State(state): State<AppState>) -> Response {
    ws.on_upgrade(move |socket| handle_ws_scan(socket, state))
}

async fn handle_ws_scan(mut socket: WebSocket, state: AppState) {
    let mut guard = state.download.lock().await;
    if guard.running {
        send_error(&mut socket, "扫描/下载已在运行中").await;
        return;
    }

    let cfg = match crate::config_db::load_config(&state.base_dir) {
        Ok(c) => c,
        Err(e) => { send_error(&mut socket, &format!("配置加载失败: {e}")).await; return; }
    };

    // Optional first message: ScanOptions JSON
    let options: ScanOptions = {
        let maybe = tokio::time::timeout(
            std::time::Duration::from_millis(200),
            socket.recv(),
        ).await;
        match maybe {
            Ok(Some(Ok(Message::Text(t)))) => serde_json::from_str(&t).unwrap_or_default(),
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

    ws_event_loop(&mut socket, &mut rx, &cancel, |ev| {
        matches!(ev, ProgressEvent::ScanComplete { .. })
    }).await;
}

// ─── Download selected novels (WebSocket) ────────────────────────────────────

pub async fn ws_download_selected(
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
                send_error(&mut socket, &format!("无效的书单数据: {e}")).await;
                return;
            }
        },
        _ => return,
    };

    let mut guard = state.download.lock().await;
    if guard.running {
        send_error(&mut socket, "下载已在运行中").await;
        return;
    }

    let cfg = match crate::config_db::load_config(&state.base_dir) {
        Ok(c) => c,
        Err(e) => { send_error(&mut socket, &format!("配置加载失败: {e}")).await; return; }
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

    ws_event_loop(&mut socket, &mut rx, &cancel, |ev| matches!(ev, ProgressEvent::OverallDone)).await;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/// Send a Log error event over the socket.
async fn send_error(socket: &mut WebSocket, msg: &str) {
    let text = serde_json::to_string(&ProgressEvent::Log {
        message: msg.into(),
        level: "error".into(),
    }).unwrap_or_default();
    let _ = socket.send(Message::Text(text.into())).await;
}

/// Shared WebSocket event loop: forward channel events to socket, handle "stop" messages.
/// `is_done` returns true on the terminal event for this particular stream.
async fn ws_event_loop<F>(
    socket: &mut WebSocket,
    rx: &mut tokio::sync::mpsc::Receiver<ProgressEvent>,
    cancel: &Arc<Notify>,
    is_done: F,
) where
    F: Fn(&ProgressEvent) -> bool,
{
    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Some(ev) => {
                        let done = is_done(&ev);
                        if let Ok(text) = serde_json::to_string(&ev) {
                            if socket.send(Message::Text(text.into())).await.is_err() { break; }
                        }
                        if done { break; }
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

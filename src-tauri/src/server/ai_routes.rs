/// HTTP routes for AI completions (used in dev/server mode, not Tauri).
///
/// GET  /api/ai/config    — load AI config from DB
/// PUT  /api/ai/config    — save AI config to DB
/// POST /api/ai/complete  — non-streaming, returns { "text": "..." }
/// POST /api/ai/stream    — SSE streaming, data: token\n\n ... data: [DONE]\n\n
use axum::{
    body::Body,
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use futures::StreamExt;
use tokio_stream::wrappers::ReceiverStream;

use crate::models::{AiCompleteRequest, AiCompleteResponse, AiExtractRequest, AiExtractResponse};
use crate::ai_config_db::AiMultiConfig;
use super::error::AppError;
use super::state::AppState;

/// Load AI config from SQLite.
pub async fn get_ai_config(
    State(state): State<AppState>,
) -> Result<Json<AiMultiConfig>, AppError> {
    let cfg = crate::ai_config_db::load(&state.base_dir).await?;
    Ok(Json(cfg))
}

/// Save AI config to SQLite.
pub async fn put_ai_config(
    State(state): State<AppState>,
    Json(cfg): Json<AiMultiConfig>,
) -> Result<Json<serde_json::Value>, AppError> {
    crate::ai_config_db::save(&state.base_dir, &cfg).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

/// Non-streaming completion — returns full text in one JSON response.
pub async fn post_ai_complete(
    Json(req): Json<AiCompleteRequest>,
) -> Result<Json<AiCompleteResponse>, AppError> {
    let text = crate::ai::complete(&req.config, &req.system_prompt, &req.user_prompt).await?;
    Ok(Json(AiCompleteResponse { text }))
}

/// SSE streaming completion — returns `text/event-stream`.
/// Each token: `data: {token}\n\n`
/// End of stream: `data: [DONE]\n\n`
/// Error: `data: [ERROR] {message}\n\n`
pub async fn post_ai_stream(
    Json(req): Json<AiCompleteRequest>,
) -> impl IntoResponse {
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<String, String>>(256);

    tokio::spawn(async move {
        let tx_stream = tx.clone();
        let result = crate::ai::stream_with_callback(
            &req.config,
            &req.system_prompt,
            &req.user_prompt,
            move |token| {
                // Escape newlines in token so SSE format is preserved
                let escaped = token.replace('\n', "\\n");
                let _ = tx_stream.try_send(Ok(format!("data: {escaped}\n\n")));
            },
        ).await;

        match result {
            Ok(()) => {
                let _ = tx.try_send(Ok("data: [DONE]\n\n".to_string()));
            }
            Err(e) => {
                let _ = tx.try_send(Err(format!("data: [ERROR] {e}\n\n")));
            }
        }
    });

    let stream = ReceiverStream::new(rx).map(|item| {
        match item {
            Ok(s) | Err(s) => Ok::<_, std::convert::Infallible>(s),
        }
    });

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/event-stream")
        .header(header::CACHE_CONTROL, "no-cache")
        .header(header::CONNECTION, "keep-alive")
        .body(Body::from_stream(stream))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

/// Structured extraction via kumo LlmClient bridge.
/// POST /api/ai/extract  →  { "data": { ...extracted fields... } }
pub async fn post_ai_extract(
    Json(req): Json<AiExtractRequest>,
) -> Result<Json<AiExtractResponse>, AppError> {
    let data = crate::ai::extract_fields(&req.config, &req.schema, &req.html).await?;
    Ok(Json(AiExtractResponse { data }))
}

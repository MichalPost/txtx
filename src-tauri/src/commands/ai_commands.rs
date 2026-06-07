use tauri::{AppHandle, Emitter};
use super::worker::app_data_dir;

/// Load AI config from SQLite (uses app.db under appDataDir).
#[tauri::command]
pub async fn load_ai_config(app: AppHandle) -> Result<crate::ai_config_db::AiMultiConfig, String> {
    let base_dir = app_data_dir(&app);
    crate::ai_config_db::load(&base_dir).await.map_err(|e| e.to_string())
}

/// Save AI config to SQLite.
#[tauri::command]
pub async fn save_ai_config(
    app: AppHandle,
    config: crate::ai_config_db::AiMultiConfig,
) -> Result<(), String> {
    let base_dir = app_data_dir(&app);
    crate::ai_config_db::save(&base_dir, &config).await.map_err(|e| e.to_string())
}

/// Structured extraction (kumo LlmClient bridge). Used for direct content extraction mode.
#[tauri::command]
pub async fn ai_extract(
    request: crate::models::AiExtractRequest,
) -> Result<crate::models::AiExtractResponse, String> {
    let data = crate::ai::extract_fields(&request.config, &request.schema, &request.html)
        .await
        .map_err(|e| e.to_string())?;
    Ok(crate::models::AiExtractResponse { data })
}

/// Non-streaming AI completion. Used for batch XPath analysis.
#[tauri::command]
pub async fn ai_complete(
    request: crate::models::AiCompleteRequest,
) -> Result<crate::models::AiCompleteResponse, String> {
    let text = crate::ai::complete(&request.config, &request.system_prompt, &request.user_prompt)
        .await
        .map_err(|e| e.to_string())?;
    Ok(crate::models::AiCompleteResponse { text })
}

/// Streaming AI completion. Emits `ai_token` events to the frontend.
/// `stream_id` is a client-generated UUID so the frontend can correlate events.
#[tauri::command]
pub async fn ai_stream_complete(
    app: AppHandle,
    request: crate::models::AiCompleteRequest,
    stream_id: String,
) -> Result<(), String> {
    use crate::models::AiTokenEvent;

    let sid = stream_id.clone();
    let app2 = app.clone();

    let result = crate::ai::stream_with_callback(
        &request.config,
        &request.system_prompt,
        &request.user_prompt,
        move |token| {
            let _ = app2.emit("ai_token", AiTokenEvent {
                stream_id: sid.clone(),
                token: Some(token),
                done: false,
                error: None,
            });
        },
    ).await;

    match result {
        Ok(()) => {
            // Signal stream end
            let _ = app.emit("ai_token", AiTokenEvent {
                stream_id,
                token: None,
                done: true,
                error: None,
            });
            Ok(())
        }
        Err(e) => {
            let _ = app.emit("ai_token", AiTokenEvent {
                stream_id,
                token: None,
                done: true,
                error: Some(e.to_string()),
            });
            Err(e.to_string())
        }
    }
}

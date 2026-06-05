use axum::{extract::State, Json};
use serde_json::json;

use super::error::AppError;
use super::state::AppState;

pub async fn get_queue(State(state): State<AppState>) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = crate::config_db::load_config(&state.base_dir)?;
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

pub async fn delete_queue(State(state): State<AppState>) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = crate::config_db::load_config(&state.base_dir)?;
    let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
    let path = base_dir.join("download_queue.json");
    if path.exists() {
        tokio::fs::remove_file(&path).await
            .map_err(|e| anyhow::anyhow!("删除队列失败: {}", e))?;
    }
    Ok(Json(json!({ "ok": true })))
}

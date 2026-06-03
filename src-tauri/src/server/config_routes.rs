use axum::Json;
use serde_json::json;

use crate::config;
use crate::models::AppConfig;
use super::error::AppError;

pub async fn get_config() -> Result<Json<AppConfig>, AppError> {
    Ok(Json(config::load_config()?))
}

pub async fn put_config(Json(cfg): Json<AppConfig>) -> Result<Json<serde_json::Value>, AppError> {
    config::save_config(&cfg)?;
    Ok(Json(json!({ "ok": true })))
}

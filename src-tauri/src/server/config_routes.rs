use axum::{extract::State, Json};
use serde_json::json;

use super::state::AppState;
use crate::models::AppConfig;
use super::error::AppError;

pub async fn get_config(State(state): State<AppState>) -> Result<Json<AppConfig>, AppError> {
    Ok(Json(crate::config_db::load_config(&state.base_dir)?))
}

pub async fn put_config(
    State(state): State<AppState>,
    Json(cfg): Json<AppConfig>,
) -> Result<Json<serde_json::Value>, AppError> {
    crate::config_db::save_config(&state.base_dir, &cfg)?;
    Ok(Json(json!({ "ok": true })))
}

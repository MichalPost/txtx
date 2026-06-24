use axum::Json;
use serde::Deserialize;
use serde_json::json;

use super::error::AppError;

// ─── Merge files ──────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct MergeRequest {
    pub paths: Vec<String>,
    pub output: String,
}

pub async fn post_merge_files(
    Json(req): Json<MergeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let msg = crate::text_tools::merge_files(req.paths, req.output).await?;
    Ok(Json(json!({ "message": msg })))
}

// ─── Split file ───────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct SplitRequest {
    pub path: String,
    pub pattern: Option<String>,
}

pub async fn post_split_file(Json(req): Json<SplitRequest>) -> Result<Json<Vec<String>>, AppError> {
    let outputs = crate::text_tools::split_file(req.path, req.pattern).await?;
    Ok(Json(outputs))
}

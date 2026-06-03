use axum::{extract::Query, Json};
use serde_json::json;
use std::collections::HashMap;

use crate::config;
use super::error::AppError;

pub async fn get_history() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = config::load_config()?;
    let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
    let entries = crate::history::load_history(&base_dir).await?;
    let value = serde_json::to_value(entries)
        .map_err(|e| AppError(anyhow::anyhow!("{}", e)))?;
    Ok(Json(value))
}

pub async fn get_history_page(
    Query(q): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = config::load_config()?;
    let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
    let query = crate::history::HistoryQuery {
        page: q.get("page").and_then(|v| v.parse().ok()),
        page_size: q.get("page_size").and_then(|v| v.parse().ok()),
        search: q.get("search").cloned(),
        status: q.get("status").cloned(),
        site: q.get("site").cloned(),
    };
    let page = crate::history::query_history(&base_dir, query).await?;
    let value = serde_json::to_value(page)
        .map_err(|e| AppError(anyhow::anyhow!("{}", e)))?;
    Ok(Json(value))
}

pub async fn get_history_stats(
    Query(q): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = config::load_config()?;
    let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
    let days = q.get("days").and_then(|v| v.parse::<i64>().ok()).unwrap_or(30);
    let daily = crate::history::get_daily_stats(&base_dir, days).await?;
    let sites = crate::history::get_site_stats(&base_dir).await?;
    Ok(Json(json!({ "daily": daily, "sites": sites })))
}

pub async fn delete_history() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = config::load_config()?;
    let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
    crate::history::clear_history(&base_dir).await?;
    Ok(Json(json!({ "ok": true })))
}

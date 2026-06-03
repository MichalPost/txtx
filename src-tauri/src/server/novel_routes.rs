use std::sync::Arc;
use axum::{extract::Query, Json};
use serde::Deserialize;
use serde_json::json;

use crate::config;
use super::error::AppError;

#[derive(Deserialize)]
pub struct NovelNameQuery {
    pub url: String,
}

pub async fn get_novel_name(
    Query(q): Query<NovelNameQuery>,
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

pub async fn post_open_dir() -> Json<serde_json::Value> {
    // In HTTP/dev mode, opening directory is not supported.
    // Tauri mode handles this via the open_output_dir invoke command.
    Json(json!({ "ok": true }))
}

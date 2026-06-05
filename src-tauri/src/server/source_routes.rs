use axum::{Json, extract::{Query, State}};
use serde::{Deserialize, Serialize};

use crate::crawler::http_client::{build_client, fetch_page};
use super::error::AppError;
use super::state::AppState;

#[derive(Deserialize)]
pub struct SourceQuery {
    url: String,
}

#[derive(Serialize)]
pub struct SourceResponse {
    html: String,
}

/// GET /api/source?url=<encoded-url>
/// 代理抓取目标页面源码，供前端规则向导使用（绕过浏览器 CORS 限制）。
pub async fn get_source(
    State(state): State<AppState>,
    Query(q): Query<SourceQuery>,
) -> Result<Json<SourceResponse>, AppError> {
    let cfg = crate::config_db::load_config(&state.base_dir)?;
    let client = build_client(&cfg.network)?;
    let html = fetch_page(&client, &q.url, &cfg.network.encoding_map, cfg.network.retry_count, cfg.network.retry_delay).await?;
    Ok(Json(SourceResponse { html }))
}

use axum::{extract::{Query, State}, Json};
use serde::Deserialize;

use super::error::AppError;
use super::state::AppState;
use crate::models::SiteHealth;

#[derive(Debug, Deserialize, Default)]
pub struct HealthQuery {
    #[serde(default, rename = "site")]
    pub sites: Vec<String>,
}

pub async fn get_health(
    State(state): State<AppState>,
    Query(query): Query<HealthQuery>,
) -> Result<Json<Vec<SiteHealth>>, AppError> {
    let cfg = crate::config_db::load_config(&state.base_dir)?;
    let selected = (!query.sites.is_empty()).then_some(query.sites.as_slice());
    let results = crate::crawler::check_site_health(&cfg, selected).await?;
    Ok(Json(results))
}

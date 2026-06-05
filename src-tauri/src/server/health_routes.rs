use axum::{extract::State, Json};

use crate::models::SiteHealth;
use super::error::AppError;
use super::state::AppState;

pub async fn get_health(State(state): State<AppState>) -> Result<Json<Vec<SiteHealth>>, AppError> {
    let cfg = crate::config_db::load_config(&state.base_dir)?;
    let results = crate::crawler::check_site_health(&cfg).await?;
    Ok(Json(results))
}

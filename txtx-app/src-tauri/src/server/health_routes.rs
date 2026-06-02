use axum::Json;

use crate::config;
use crate::models::SiteHealth;
use super::error::AppError;

pub async fn get_health() -> Result<Json<Vec<SiteHealth>>, AppError> {
    let cfg = config::load_config()?;
    let results = crate::crawler::check_site_health(&cfg).await?;
    Ok(Json(results))
}

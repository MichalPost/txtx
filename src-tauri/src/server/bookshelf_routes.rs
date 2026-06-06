use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;

use super::state::AppState;
use crate::bookshelf::{delete_book, list_books, BookFile};

#[derive(Deserialize)]
pub struct BooksQuery {
    pub dir: Option<String>,
}

pub async fn get_books(
    State(state): State<AppState>,
    Query(q): Query<BooksQuery>,
) -> Result<Json<Vec<BookFile>>, (StatusCode, String)> {
    let dir = if let Some(d) = q.dir.filter(|s| !s.is_empty()) {
        d
    } else {
        let base = state.base_dir.clone();
        let cfg = tokio::task::spawn_blocking(move || crate::config_db::load_config(&base))
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        cfg.paths.base_dir
    };
    list_books(&dir)
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

#[derive(Deserialize)]
pub struct DeleteBookBody {
    pub path: String,
}

pub async fn delete_book_route(
    Json(body): Json<DeleteBookBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    delete_book(&body.path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn get_calibre_detect() -> Json<serde_json::Value> {
    let path = crate::bookshelf::detect_calibre();
    Json(serde_json::json!({ "path": path }))
}

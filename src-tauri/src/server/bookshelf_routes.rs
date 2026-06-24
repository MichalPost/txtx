use axum::{
    extract::Json,
    extract::{Query, State},
    http::StatusCode,
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
    delete_book(&body.path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn get_calibre_detect() -> Json<serde_json::Value> {
    let path = crate::bookshelf::detect_calibre();
    Json(serde_json::json!({ "path": path }))
}

pub async fn open_book_parent_route(
    Json(body): Json<DeleteBookBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let parent = std::path::PathBuf::from(body.path)
        .parent()
        .map(|value| value.to_path_buf())
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "无法定位文件所在目录".to_string()))?;
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(parent)
            .spawn()
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(parent)
            .spawn()
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}

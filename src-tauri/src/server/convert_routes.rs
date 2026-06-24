use axum::Json;
use serde::Deserialize;
use serde_json::json;

use super::error::AppError;

#[derive(Deserialize)]
pub struct ConvertRequest {
    pub path: String,
}

pub async fn post_convert_text(
    Json(req): Json<ConvertRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let p = std::path::PathBuf::from(&req.path);
    let decoded = crate::text_file::read_text_file_auto(&p).await?;
    let text = decoded.content;
    let (converted, changed) = crate::text_converter::detect_and_convert(&text, true);
    if changed {
        tokio::fs::write(&p, converted.as_bytes())
            .await
            .map_err(|e| anyhow::anyhow!("写入文件失败: {}", e))?;
    }
    Ok(Json(json!({
        "changed": changed,
        "path": req.path,
        "encoding": decoded.encoding.label(),
    })))
}

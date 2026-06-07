use tauri::AppHandle;
use super::worker::app_data_dir;

#[tauri::command]
pub async fn get_history(app: AppHandle) -> Result<Vec<crate::history::HistoryEntry>, String> {
    let dir = app_data_dir(&app);
    let cfg = tokio::task::spawn_blocking(move || crate::config_db::load_config(&dir))
        .await.map_err(|e| e.to_string())?.map_err(|e| e.to_string())?;
    let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
    crate::history::load_history(&base_dir).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_history(app: AppHandle) -> Result<(), String> {
    let dir = app_data_dir(&app);
    let cfg = tokio::task::spawn_blocking(move || crate::config_db::load_config(&dir))
        .await.map_err(|e| e.to_string())?.map_err(|e| e.to_string())?;
    let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
    crate::history::clear_history(&base_dir).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_sites(app: AppHandle) -> Result<Vec<crate::models::SiteHealth>, String> {
    let dir = app_data_dir(&app);
    let cfg = tokio::task::spawn_blocking(move || crate::config_db::load_config(&dir))
        .await.map_err(|e| e.to_string())?.map_err(|e| e.to_string())?;
    crate::crawler::check_site_health(&cfg).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn convert_file(path: String) -> Result<String, String> {
    let p = std::path::PathBuf::from(&path);
    let text = tokio::fs::read_to_string(&p).await
        .map_err(|e| e.to_string())?;
    let (converted, changed) = crate::text_converter::detect_and_convert(&text, true);
    if changed {
        tokio::fs::write(&p, converted.as_bytes()).await
            .map_err(|e| e.to_string())?;
        Ok(format!("转换完成: {}", p.display()))
    } else {
        Ok(format!("无需转换（未检测到繁体字）: {}", p.display()))
    }
}

#[tauri::command]
pub async fn get_queue(app: AppHandle) -> Result<serde_json::Value, String> {
    let dir = app_data_dir(&app);
    let cfg = tokio::task::spawn_blocking(move || crate::config_db::load_config(&dir))
        .await.map_err(|e| e.to_string())?.map_err(|e| e.to_string())?;
    let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
    let path = base_dir.join("download_queue.json");
    if !path.exists() {
        return Ok(serde_json::json!({ "exists": false }));
    }
    let data = tokio::fs::read_to_string(&path).await.map_err(|e| e.to_string())?;
    let queue: serde_json::Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    let item_count = queue["items"].as_array().map(|a| a.len()).unwrap_or(0);
    Ok(serde_json::json!({
        "exists": true,
        "created_at": queue["created_at"],
        "target_date": queue["target_date"],
        "item_count": item_count,
    }))
}

#[tauri::command]
pub async fn clear_queue(app: AppHandle) -> Result<(), String> {
    let dir = app_data_dir(&app);
    let cfg = tokio::task::spawn_blocking(move || crate::config_db::load_config(&dir))
        .await.map_err(|e| e.to_string())?.map_err(|e| e.to_string())?;
    let base_dir = std::path::PathBuf::from(&cfg.paths.base_dir);
    let path = base_dir.join("download_queue.json");
    if path.exists() {
        tokio::fs::remove_file(&path).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn preview_novel_name(app: AppHandle, url: String) -> Result<serde_json::Value, String> {
    let dir = app_data_dir(&app);
    let cfg = tokio::task::spawn_blocking(move || crate::config_db::load_config(&dir))
        .await.map_err(|e| e.to_string())?.map_err(|e| e.to_string())?;
    let client = std::sync::Arc::new(
        crate::crawler::build_client(&cfg.network).map_err(|e| e.to_string())?
    );
    let site_cfg = cfg.websites.values()
        .find(|s| s.enabled && url.contains(&s.domain_name))
        .cloned();
    let xpath = site_cfg.as_ref().map(|s| s.novel_name_x.clone()).unwrap_or_default();
    if xpath.is_empty() {
        return Ok(serde_json::json!({ "name": null }));
    }
    match crate::crawler::fetch_novel_name(
        &client, &url, &xpath, &cfg.network.encoding_map,
        cfg.network.retry_count, cfg.network.retry_delay,
    ).await {
        Some(name) => Ok(serde_json::json!({ "name": name })),
        None => Ok(serde_json::json!({ "name": null })),
    }
}

#[tauri::command]
pub async fn open_output_dir(app: tauri::AppHandle) -> Result<(), String> {
    let dir = app_data_dir(&app);
    let cfg = tokio::task::spawn_blocking(move || crate::config_db::load_config(&dir))
        .await.map_err(|e| e.to_string())?.map_err(|e| e.to_string())?;
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_path(&cfg.paths.base_dir, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_books(app: AppHandle, dir: String) -> Result<Vec<crate::bookshelf::BookFile>, String> {
    let effective_dir = if dir.is_empty() {
        let data_dir = app_data_dir(&app);
        let cfg = tokio::task::spawn_blocking(move || crate::config_db::load_config(&data_dir))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?;
        cfg.paths.base_dir
    } else {
        dir
    };
    crate::bookshelf::list_books(&effective_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_book(path: String) -> Result<(), String> {
    crate::bookshelf::delete_book(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_book(app: AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_path(&path, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn detect_calibre() -> Result<Option<String>, String> {
    Ok(crate::bookshelf::detect_calibre())
}

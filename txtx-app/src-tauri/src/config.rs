use std::path::PathBuf;
use anyhow::{Context, Result};
use crate::models::AppConfig;

pub fn config_path() -> PathBuf {
    // 1. Explicit override via environment variable
    if let Ok(p) = std::env::var("TXTX_CONFIG") {
        return PathBuf::from(p);
    }

    // 2. Config lives next to the executable in production
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));

    let candidate = exe_dir.join("config").join("config.yml");
    if candidate.exists() {
        return candidate;
    }

    // 3. Walk up from the current working directory to find config/config.yml
    //    (handles dev mode where cwd is src-tauri/ or txtx-app/)
    if let Ok(cwd) = std::env::current_dir() {
        let mut dir = cwd.as_path();
        loop {
            let candidate = dir.join("config").join("config.yml");
            if candidate.exists() {
                return candidate;
            }
            match dir.parent() {
                Some(parent) => dir = parent,
                None => break,
            }
        }
    }

    // 4. Final fallback: relative path from cwd
    PathBuf::from("config/config.yml")
}

pub fn load_config() -> Result<AppConfig> {
    let path = config_path();
    let content = std::fs::read_to_string(&path)
        .with_context(|| format!("无法读取配置文件: {}", path.display()))?;
    let config: AppConfig = serde_yaml::from_str(&content)
        .with_context(|| "配置文件格式错误")?;
    Ok(config)
}

pub fn save_config(config: &AppConfig) -> Result<()> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let content = serde_yaml::to_string(config)
        .context("序列化配置失败")?;
    std::fs::write(&path, content)
        .with_context(|| format!("写入配置文件失败: {}", path.display()))?;
    Ok(())
}

/// Update last_download_date in the config file.
pub fn update_last_download_date(date: &str) -> Result<()> {
    let mut config = load_config()?;
    config.filtering.last_download_date = Some(date.to_string());
    save_config(&config)
}

use chrono::Local;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::models::ProgressEvent;

// ─── File logger ──────────────────────────────────────────────────────────────

pub struct FileLogger {
    pub file: Arc<Mutex<tokio::fs::File>>,
}

impl FileLogger {
    pub async fn new(log_dir: &Path) -> Option<Self> {
        tokio::fs::create_dir_all(log_dir).await.ok()?;
        let filename = Local::now()
            .format("download_%Y%m%d_%H%M%S.log")
            .to_string();
        let file = tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_dir.join(filename))
            .await
            .ok()?;
        Some(Self {
            file: Arc::new(Mutex::new(file)),
        })
    }

    pub async fn write(&self, level: &str, message: &str) {
        use tokio::io::AsyncWriteExt;
        let line = format!(
            "[{}] [{}] {}\n",
            Local::now().format("%Y-%m-%d %H:%M:%S"),
            level.to_uppercase(),
            message
        );
        let _ = self.file.lock().await.write_all(line.as_bytes()).await;
    }

    pub async fn write_result(&self, name: &str, success: bool, err_msg: Option<&str>) {
        use tokio::io::AsyncWriteExt;
        let (lvl, msg) = if success {
            ("SUCCESS", format!("✓ {} 下载完成", name))
        } else {
            (
                "ERROR",
                format!("✗ {} 失败: {}", name, err_msg.unwrap_or("unknown")),
            )
        };
        let line = format!(
            "[{}] [{}] {}\n",
            Local::now().format("%Y-%m-%d %H:%M:%S"),
            lvl,
            msg
        );
        let _ = self.file.lock().await.write_all(line.as_bytes()).await;
    }
}

// ─── Helper: send log event + optionally write to file ────────────────────────

pub async fn log(
    tx: &tokio::sync::mpsc::Sender<ProgressEvent>,
    logger: Option<&FileLogger>,
    level: &str,
    message: String,
) {
    if let Some(l) = logger {
        l.write(level, &message).await;
    }
    let _ = tx
        .send(ProgressEvent::Log {
            message,
            level: level.into(),
        })
        .await;
}

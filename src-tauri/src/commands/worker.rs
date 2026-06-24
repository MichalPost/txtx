use crate::models::{ProgressEvent, TaskEvent, TaskId, TaskStatus};
use crate::task_manager::SharedTaskManager;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

pub(super) fn app_data_dir(app: &AppHandle) -> std::path::PathBuf {
    get_app_data_dir(app)
}

/// 公开版本，供 lib.rs 的 setup 阶段使用
pub fn get_app_data_dir(app: &AppHandle) -> std::path::PathBuf {
    // 开发模式：把数据库放在项目目录下的 data/ 文件夹，方便直接查看和调试
    #[cfg(debug_assertions)]
    {
        let _ = app; // 避免 unused 警告
        let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let data_dir = manifest_dir.parent().unwrap_or(&manifest_dir).join("data");
        std::fs::create_dir_all(&data_dir).ok();
        return data_dir;
    }
    // 生产模式：使用系统 AppData 目录
    #[cfg(not(debug_assertions))]
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
}

pub(super) async fn spawn_task_worker<F, Fut>(
    app: AppHandle,
    tm: SharedTaskManager,
    task_id: TaskId,
    future_factory: F,
) where
    F: FnOnce(mpsc::Sender<ProgressEvent>) -> Fut + Send + 'static,
    Fut: std::future::Future<Output = anyhow::Result<()>> + Send + 'static,
{
    let (tx, mut rx) = mpsc::channel::<ProgressEvent>(512);

    let app_clone = app.clone();
    let tid = task_id.clone();
    let tm_rx = tm.clone();

    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            let mut persist_snapshot = None;
            {
                let mut mgr = tm_rx.lock().await;
                match &event {
                    ProgressEvent::NovelDone { .. } => {
                        mgr.update_record(&tid, |r| {
                            r.completed = r.completed.saturating_add(1);
                            r.success_count += 1;
                        });
                    }
                    ProgressEvent::NovelError { .. } => {
                        mgr.update_record(&tid, |r| {
                            r.completed = r.completed.saturating_add(1);
                            r.error_count += 1;
                        });
                    }
                    ProgressEvent::FilterDone { stats } => {
                        let n = stats.final_download;
                        let s = stats.clone();
                        mgr.update_record(&tid, |r| {
                            r.total = n;
                            r.stats = Some(s);
                            r.status = TaskStatus::Downloading;
                        });
                        persist_snapshot = mgr.get_record(&tid).cloned();
                    }
                    ProgressEvent::ScanComplete { items, stats } => {
                        let items2 = items.clone();
                        let stats2 = stats.clone();
                        mgr.update_record(&tid, |r| {
                            r.scan_items = items2;
                            r.scan_stats = Some(stats2);
                            r.status = TaskStatus::Preview;
                        });
                        persist_snapshot = mgr.get_record(&tid).cloned();
                    }
                    ProgressEvent::ScanStart { .. } => {
                        mgr.update_record(&tid, |r| {
                            r.status = TaskStatus::Scanning;
                        });
                    }
                    ProgressEvent::OverallDone => {
                        mgr.update_record(&tid, |r| {
                            r.status = TaskStatus::Done;
                            r.finished_at =
                                Some(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
                            r.error_message = None;
                        });
                        persist_snapshot = mgr.get_record(&tid).cloned();
                    }
                    _ => {}
                }
            }
            if let Some(record) = persist_snapshot {
                let base_dir = {
                    let mgr = tm_rx.lock().await;
                    mgr.base_dir.clone()
                };
                let _ = crate::task_manager::db::save_task(&base_dir, &record).await;
            }
            let task_event = TaskEvent {
                task_id: tid.clone(),
                event,
            };
            let _ = app_clone.emit("task_event", &task_event);
        }
    });

    let tm_done = tm.clone();
    let tid2 = task_id.clone();
    tokio::spawn(async move {
        let result = future_factory(tx).await;
        if let Err(e) = result {
            let err_str = e.to_string();
            let (base_dir, snapshot) = {
                let mut mgr = tm_done.lock().await;
                mgr.update_record(&tid2, |r| {
                    r.status = TaskStatus::Failed;
                    r.error_message = Some(err_str);
                    r.finished_at =
                        Some(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
                });
                (mgr.base_dir.clone(), mgr.get_record(&tid2).cloned())
            };
            if let Some(record) = snapshot {
                let _ = crate::task_manager::db::save_task(&base_dir, &record).await;
            }
        }
    });
}

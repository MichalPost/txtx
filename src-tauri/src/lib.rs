pub mod models;
pub mod config;
pub mod config_db;
pub mod ai;
pub mod ai_config_db;
pub mod blacklist;
pub mod bookshelf;
pub mod crawler;
pub mod downloader;
pub mod server;
pub mod text_converter;
pub mod ebook_converter;
pub mod history;
pub mod task_manager;
pub mod single_downloader;
pub mod ttks_downloader;

#[cfg(debug_assertions)]
pub mod dev_tools;

pub mod kumo_scanner;

// ─── Tauri integration ────────────────────────────────────────────────────────

#[cfg(feature = "tauri-build")]
mod tauri_app {
    pub mod commands;

    use std::sync::Arc;
    use tokio::sync::Mutex;
    use tauri::Manager;
    use crate::task_manager::{TaskManager, SharedTaskManager};
    use commands::*;

    pub fn run() {
        let task_manager: SharedTaskManager =
            Arc::new(Mutex::new(TaskManager::new(std::path::PathBuf::from("."))));

        tauri::Builder::default()
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_fs::init())
            .manage(task_manager)
            .setup(|app| {
                // Re-initialize task manager base_dir after app is running
                // (app_data_dir is now available via the app handle)
                let tm = app.state::<SharedTaskManager>();
                let data_dir = app.path().app_data_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from("."));
                if let Ok(cfg) = crate::config_db::load_config(&data_dir) {
                    if !cfg.paths.base_dir.is_empty() {
                        let base = std::path::PathBuf::from(&cfg.paths.base_dir);
                        let mut mgr = tm.blocking_lock();
                        mgr.base_dir = base;
                    }
                }
                Ok(())
            })
            .invoke_handler(tauri::generate_handler![
                load_config,
                save_config,
                check_first_run,
                complete_setup,
                pick_directory,
                fetch_source,
                // New task manager commands
                create_scan_task,
                create_batch_download_task,
                create_single_download_task,
                confirm_task_download,
                list_tasks,
                get_task,
                cancel_task,
                pause_task,
                delete_task,
                load_persisted_tasks,
                // Legacy shim commands
                start_scan,
                download_selected,
                start_download,
                stop_download,
                download_single,
                // Other
                get_history,
                clear_history,
                check_sites,
                convert_file,
                get_queue,
                clear_queue,
                preview_novel_name,
                open_output_dir,
                // Bookshelf
                list_books,
                delete_book,
                open_book,
                detect_calibre,
                // AI
                ai_complete,
                ai_stream_complete,
                ai_extract,
                load_ai_config,
                save_ai_config,
            ])
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }
}

#[cfg(feature = "tauri-build")]
pub use tauri_app::run;

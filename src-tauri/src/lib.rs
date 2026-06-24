pub mod ai;
pub mod ai_config_db;
pub mod blacklist;
pub mod bookshelf;
pub mod config;
pub mod config_db;
pub mod crawler;
pub mod downloader;
pub mod ebook_converter;
pub mod history;
pub mod models;
pub mod rate_limited_downloader;
pub mod server;
pub mod single_downloader;
pub mod task_manager;
pub mod text_file;
pub mod text_converter;

#[cfg(debug_assertions)]
pub mod dev_tools;

pub mod kumo_scanner;
pub mod text_tools;

// ─── Tauri integration ────────────────────────────────────────────────────────

#[cfg(feature = "tauri-build")]
pub mod commands;

#[cfg(feature = "tauri-build")]
mod tauri_app {
    #[allow(unused_imports)]
    use crate::commands::*;
    use crate::task_manager::{SharedTaskManager, TaskManager};
    use std::sync::Arc;
    use tauri::Manager;
    use tokio::sync::Mutex;

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
                let data_dir = crate::commands::worker::get_app_data_dir(app.handle());
                if let Ok(cfg) = crate::config_db::load_config(&data_dir) {
                    let base = if !cfg.paths.base_dir.is_empty() {
                        std::path::PathBuf::from(&cfg.paths.base_dir)
                    } else {
                        std::path::PathBuf::from(".")
                    };
                    let max_c = cfg.concurrency.novel_threads.clamp(1, 5);
                    let mut mgr = tm.blocking_lock();
                    mgr.base_dir = base;
                    mgr.max_concurrent = max_c;
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
                create_selected_download_task,
                confirm_task_download,
                update_task_preview_draft,
                list_tasks,
                get_task,
                cancel_task,
                pause_task,
                delete_task,
                load_persisted_tasks,
                cancel_active_tasks,
                // Other
                get_history,
                query_history,
                get_history_stats,
                get_history_site_options,
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
                open_book_parent,
                detect_calibre,
                // Text tools
                merge_files,
                split_file,
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

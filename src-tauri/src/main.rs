// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(feature = "tauri-build")]
    txtx_app_lib::run();

    #[cfg(not(feature = "tauri-build"))]
    {
        eprintln!("This binary requires the 'tauri-build' feature. Use 'cargo run --bin txtx-server' for the standalone server.");
    }
}

fn main() {
    // tauri-build 只在 tauri-build feature 启用时运行
    #[cfg(feature = "tauri-build")]
    tauri_build::build();
}

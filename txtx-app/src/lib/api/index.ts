/**
 * API 抽象层 - 统一导出入口
 *
 * 开发模式：直接请求 Rust HTTP 服务器 (http://localhost:3721)
 * Tauri 模式：通过 tauri invoke（编译时注入 VITE_TAURI_MODE=true）
 */

export * from "./config";
export * from "./download";
export * from "./history";
export * from "./files";
export * from "./tasks";

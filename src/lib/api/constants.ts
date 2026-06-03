export const IS_TAURI = import.meta.env.VITE_TAURI_MODE === "true";
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3721";
export const WS_BASE = API_BASE.replace(/^http/, "ws");

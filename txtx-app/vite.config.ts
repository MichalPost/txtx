import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// @ts-ignore process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-ignore process is a nodejs global
const isTauri = process.env.VITE_TAURI_MODE === "true";
// @ts-ignore process is a nodejs global
const isProd = process.env.NODE_ENV === "production";

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  // 路径别名，避免 ../../ 地狱
  resolve: {
    alias: {
      "@": r("src"),
      "@components": r("src/components"),
      "@pages": r("src/pages"),
      "@store": r("src/store"),
      "@lib": r("src/lib"),
      "@types": r("src/types"),
    },
  },

  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    // 开发时代理 API 请求到 Rust 后端（仅非 Tauri 模式）
    proxy: isTauri
      ? {}
      : {
          "/api": {
            target: "http://localhost:3721",
            changeOrigin: true,
            ws: true,
          },
        },
  },

  build: {
    // Tauri 要求最低 ES2021，桌面端不需要兼容旧浏览器
    target: isTauri ? ["es2021", "chrome105", "safari15"] : "modules",
    // 开发构建保留 sourcemap，生产不生成
    sourcemap: !isProd,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 超过 500KB 的 chunk 给出警告
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // 手动拆分大型依赖，优化加载性能与缓存命中率
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "router": ["react-router-dom"],
          "query": ["@tanstack/react-query"],
          "ui": ["lucide-react", "sonner"],
          "utils": ["dayjs", "zustand", "animejs"],
        },
        // 资源文件按类型分目录
        assetFileNames: "assets/[ext]/[name]-[hash][extname]",
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
      },
    },
    // esbuild 压缩，速度比 terser 快
    minify: "esbuild",
  },

  // 预构建优化：将 CJS 依赖转为 ESM，加速冷启动
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "zustand",
      "dayjs",
      "lucide-react",
      "animejs",
    ],
  },

  // 让前端知道当前是否在 Tauri 环境
  define: {
    "import.meta.env.VITE_TAURI_MODE": JSON.stringify(
      isTauri ? "true" : "false"
    ),
    "import.meta.env.VITE_API_BASE": JSON.stringify(
      isTauri ? "" : "http://localhost:3721"
    ),
  },

  // esbuild 转换选项
  esbuild: {
    // 生产构建移除 console 和 debugger
    drop: isProd ? ["console", "debugger"] : [],
    // 非生产保留组件 displayName，方便 React DevTools 调试
    keepNames: !isProd,
  },
});

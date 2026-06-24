/// <reference types="node" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const host = process.env.TAURI_DEV_HOST;
const isTauri = process.env.VITE_TAURI_MODE === "true";
const isProd = process.env.NODE_ENV === "production";
const apiBase = process.env.VITE_API_BASE ?? `http://localhost:${process.env.TXTX_PORT ?? "3721"}`;

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
            target: apiBase,
            changeOrigin: true,
            ws: true,
          },
        },
  },

  build: {
    // Tauri 要求最低 ES2021，桌面端不需要兼容旧浏览器
    // Vite 8 (rolldown) 不再支持 "modules"，web 模式改为 "baseline-widely-available"
    target: isTauri ? ["es2021", "chrome105", "safari15"] : "baseline-widely-available",
    // 开发构建保留 sourcemap，生产不生成
    sourcemap: !isProd,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 超过 800KB 的 chunk 给出警告（react-dom 本身 ~250KB gzip，页面 chunk 合理上限）
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Vite 8 (rolldown) 要求 manualChunks 使用函数形式
        manualChunks(id: string) {
          // React 核心 — 最先匹配，避免被其他规则误分
          if (id.includes("react-dom") || id.includes("/react/")) return "react-vendor";
          if (id.includes("react-router-dom")) return "router";
          // 数据层
          if (id.includes("@tanstack/react-query")) return "query";
          if (id.includes("@tanstack/react-table") || id.includes("@tanstack/react-virtual")) return "table";
          // 图表库 — 只在 HistoryPage 使用，单独 chunk 让其他页面不加载
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-")) return "charts";
          // 拖拽 — 只在 WebsitesPage 使用
          if (id.includes("@dnd-kit")) return "dnd";
          // 表单
          if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("zod")) return "forms";
          // UI 工具
          if (id.includes("lucide-react") || id.includes("sonner") || id.includes("cmdk")) return "ui";
          // 通用工具
          if (id.includes("dayjs") || id.includes("zustand") || id.includes("animejs") || id.includes("fuse.js") || id.includes("idb-keyval")) return "utils";
        },
        // 资源文件按类型分目录
        assetFileNames: "assets/[ext]/[name]-[hash][extname]",
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
      },
    },
    // rolldown 内置 oxc 压缩，无需 minify: "esbuild"
    minify: isProd,
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
      isTauri ? "" : apiBase
    ),
  },

  // Vite 8 (rolldown) 使用 oxc 做代码转换，esbuild 选项已废弃
  // 生产构建移除 console 通过 rolldown oxc 配置处理（默认行为即可）
});

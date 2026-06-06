import js from "@eslint/js";
import globals from "globals";
import reactPlugin from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  // 忽略的目录
  {
    ignores: ["dist/**", "node_modules/**", "src-tauri/**", "public/**",".kiro/**"],
  },

  // JS 基础推荐规则
  js.configs.recommended,

  // TypeScript + React 源码
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      "@eslint-react": reactPlugin,
      "react-hooks": reactHooks,
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // ── React 废弃 API 检测（核心目标） ──────────────────────────
      // 旧生命周期（componentWillMount/ReceiveProps/Update 直接使用，非 UNSAFE_ 前缀）
      "@eslint-react/no-component-will-mount": "error",
      "@eslint-react/no-component-will-receive-props": "error",
      "@eslint-react/no-component-will-update": "error",
      // 带 UNSAFE_ 前缀但语义上仍是废弃模式
      "@eslint-react/no-unsafe-component-will-mount": "error",
      "@eslint-react/no-unsafe-component-will-receive-props": "error",
      "@eslint-react/no-unsafe-component-will-update": "error",
      // 其他废弃 API
      "@eslint-react/dom-no-find-dom-node": "error",       // findDOMNode 已废弃
      "@eslint-react/no-create-ref": "error",              // createRef 在函数组件中应用 useRef
      "@eslint-react/dom-no-render": "error",              // ReactDOM.render 在 React 18 已废弃
      "@eslint-react/dom-no-render-return-value": "error", // 不要使用 render() 返回值
      "@eslint-react/dom-no-hydrate": "error",             // ReactDOM.hydrate 已废弃
      "@eslint-react/no-direct-mutation-state": "error",   // 直接修改 this.state

      // ── React Hooks 规则 ─────────────────────────────────────────
      "react-hooks/rules-of-hooks": "error",   // Hook 只能在顶层调用
      "react-hooks/exhaustive-deps": "warn",   // useEffect 依赖数组检查

      // ── TypeScript 基础规则 ──────────────────────────────────────
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",

      // ── 关闭与 TS 冲突的 JS 规则 ────────────────────────────────
      "no-unused-vars": "off", // 由 @typescript-eslint/no-unused-vars 接管
      "no-undef": "off",       // TypeScript 自身处理
    },
  },

  // 配置文件本身用 Node 环境
  {
    files: ["*.config.{js,ts}", "*.config.*.{js,ts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: globals.node,
    },
  },
];

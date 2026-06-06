/**
 * Prettier 3.8 (2026) Best Practices Config
 *
 * Covers all notable options added in Prettier 3.x:
 *  - 3.5: objectWrap, experimentalOperatorPosition
 *  - 3.7: TypeScript/Flow class & interface consistency
 *  - Tailwind CSS v4: tailwindStylesheet (replaces tailwindConfig)
 *  - @ianvs/prettier-plugin-sort-imports: deterministic import order
 *
 * Sources:
 *  https://prettier.io/blog/2025/02/09/3.5.0.html  (objectWrap, operatorPosition)
 *  https://prettier.io/blog/2025/11/27/3.7.0       (TS/Flow consistency)
 *  https://prettier.io/blog/2026/01/14/3.8.0       (Angular v21 support)
 *  https://npmjs.com/package/prettier-plugin-tailwindcss (tailwindStylesheet v4)
 */

/** @type {import("prettier").Config} */
const config = {
  // ── Print ────────────────────────────────────────────────────────
  printWidth: 100,       // 100 是 TypeScript/React 项目的现代主流宽度
  tabWidth: 2,
  useTabs: false,

  // ── Punctuation ──────────────────────────────────────────────────
  semi: true,            // 始终加分号，避免 ASI 陷阱
  singleQuote: false,    // 双引号（与 JSX 属性保持一致）
  jsxSingleQuote: false,
  trailingComma: "all",  // 函数参数也加尾随逗号，最小化 git diff 噪音
  bracketSpacing: true,  // { key: value }
  bracketSameLine: false,// JSX 的 > 换行，可读性更好
  arrowParens: "always", // (x) => x，利于后续添加类型注解

  // ── Line endings ─────────────────────────────────────────────────
  endOfLine: "lf",       // 跨平台统一，与 .gitattributes 一致

  // ── Object formatting (Prettier 3.5+) ────────────────────────────
  // "preserve": 尊重源码中对象的换行意图（默认行为，最安全）
  // "collapse": 总是尝试折叠到一行（更激进，减少垂直空间）
  objectWrap: "preserve",

  // ── Operator position (Prettier 3.5+, experimental) ──────────────
  // "end": 二元表达式换行时操作符保留在行末（默认）
  // "start": 操作符移到新行开头（类似 Haskell 风格）
  // 保持默认 "end"，与大多数 JS/TS 代码库一致
  // experimentalOperatorPosition: "end",  // 默认，无需显式设置

  // ── Embedded language formatting ─────────────────────────────────
  embeddedLanguageFormatting: "auto",

  // ── Plugins ──────────────────────────────────────────────────────
  // 顺序重要：sort-imports 先处理，tailwindcss 必须放最后
  plugins: [
    "@ianvs/prettier-plugin-sort-imports",
    "prettier-plugin-tailwindcss",
  ],

  // ── Tailwind CSS v4 ──────────────────────────────────────────────
  // v4 用 tailwindStylesheet 替代 v3 的 tailwindConfig
  // 指向包含 @import "tailwindcss" 的 CSS 入口文件
  tailwindStylesheet: "./src/styles.css",
  // 对这些工具函数内的字符串也做 class 排序
  tailwindFunctions: ["cn", "clsx", "cva", "twMerge", "tv"],

  // ── Import order (@ianvs/prettier-plugin-sort-imports) ───────────
  importOrder: [
    // React 生态优先
    "^(react/(.*)$)|^(react$)",
    "^(react-dom/(.*)$)|^(react-dom$)",
    "^(react-router-dom/(.*)$)|^(react-router-dom$)",
    // 第三方包
    "<THIRD_PARTY_MODULES>",
    // 空行：内部模块与第三方分隔
    "",
    // 路径别名
    "^@/(.*)$",
    "^~/(.*)$",
    // 空行：别名与相对路径分隔
    "",
    // 相对路径
    "^[./]",
  ],
  importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
  importOrderTypeScriptVersion: "5.0.0",
  importOrderCaseSensitive: false,
};

export default config;

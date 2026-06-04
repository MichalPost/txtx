# 计划：配置迁移至 SQLite + 首次运行引导流程

**日期：** 2026-06-04  
**目标：** 将所有配置数据从 `config/config.yml` 迁移到 SQLite，同时设计首次运行流程、空状态、激活引导。

---

## 一、为什么做

| 问题 | 现状 | 迁移后 |
|---|---|---|
| base_dir 硬编码 | `E:/Downloads/xs` 对不同用户直接报错 | 首次运行引导用户选择目录 |
| config.yml 位置 | 必须在可执行文件旁，路径查找逻辑复杂 | SQLite 放 Tauri appDataDir，位置固定 |
| 首次运行检测 | 无，直接报"无法读取配置文件" | `SELECT COUNT(*) FROM app_config` 即可判断 |
| 站点规则写入 | 每次保存整个 YAML 文件 | 单条记录 upsert，只写改动的行 |
| 原子性 | YAML 写到一半可能损坏 | SQLite WAL 模式，事务保证 |
| AI config | 已用 SQLite（ai_config_db.rs） | 统一到同一个 DB |

性能本身差异可忽略，主要收益是可靠性和用户体验。

---

## 二、数据库设计

文件位置：`{appDataDir}/txtx/app.db`（Tauri `app_data_dir()`）

```sql
-- 核心配置（单行，id=1）
CREATE TABLE IF NOT EXISTS app_config (
    id                          INTEGER PRIMARY KEY DEFAULT 1,
    -- paths
    base_dir                    TEXT    NOT NULL DEFAULT '',
    temp_dir                    TEXT    NOT NULL DEFAULT '',
    log_dir                     TEXT    NOT NULL DEFAULT '',
    -- network
    user_agent                  TEXT    NOT NULL DEFAULT '',
    proxy                       TEXT,
    retry_count                 INTEGER NOT NULL DEFAULT 5,
    retry_delay                 INTEGER NOT NULL DEFAULT 8,
    timeout                     INTEGER NOT NULL DEFAULT 45,
    encoding_map                TEXT    NOT NULL DEFAULT '{}',  -- JSON
    -- concurrency
    novel_threads               INTEGER NOT NULL DEFAULT 2,
    chapter_threads             INTEGER NOT NULL DEFAULT 2,
    max_connections_per_host    INTEGER NOT NULL DEFAULT 10,
    connection_pool_size        INTEGER NOT NULL DEFAULT 50,
    -- filtering
    days_limit                  INTEGER NOT NULL DEFAULT 60,
    last_download_date          TEXT,
    min_days_limit              INTEGER NOT NULL DEFAULT 1,
    site_priority               TEXT    NOT NULL DEFAULT '{}',  -- JSON
    -- blacklist (flags)
    bl_enabled                  INTEGER NOT NULL DEFAULT 1,
    bl_filter_level             TEXT    NOT NULL DEFAULT 'moderate',
    bl_case_insensitive         INTEGER NOT NULL DEFAULT 1,
    bl_fuzzy_match              INTEGER NOT NULL DEFAULT 1,
    bl_regex_match              INTEGER NOT NULL DEFAULT 1,
    bl_tag_filter               INTEGER NOT NULL DEFAULT 0,
    bl_filtered_tags            TEXT    NOT NULL DEFAULT '[]',  -- JSON
    bl_keywords                 TEXT    NOT NULL DEFAULT '[]',  -- JSON
    bl_regex_patterns           TEXT    NOT NULL DEFAULT '[]',  -- JSON
    bl_grading_rules            TEXT    NOT NULL DEFAULT '{}',  -- JSON
    -- text conversion
    tc_enabled                  INTEGER NOT NULL DEFAULT 0,
    tc_t2s                      INTEGER NOT NULL DEFAULT 0,
    tc_auto                     INTEGER NOT NULL DEFAULT 1,
    -- ebook conversion
    eb_enabled                  INTEGER NOT NULL DEFAULT 0,
    eb_formats                  TEXT    NOT NULL DEFAULT '[]',  -- JSON
    eb_calibre                  TEXT,
    -- content filter
    cf_ad_patterns              TEXT    NOT NULL DEFAULT '[]',  -- JSON
    cf_nav_keywords             TEXT    NOT NULL DEFAULT '[]',  -- JSON
    cf_safety_threshold         REAL    NOT NULL DEFAULT 0.3,
    cf_fallback_trim_lines      INTEGER NOT NULL DEFAULT 2,
    -- ttks
    ttks_domains                TEXT    NOT NULL DEFAULT '[]',  -- JSON
    ttks_delay_min              INTEGER NOT NULL DEFAULT 3000,
    ttks_delay_max              INTEGER NOT NULL DEFAULT 8000,
    ttks_ua_pool                TEXT    NOT NULL DEFAULT '[]',  -- JSON
    -- advanced network
    an_pool_idle_timeout_secs   INTEGER NOT NULL DEFAULT 90,
    an_tcp_keepalive_secs       INTEGER NOT NULL DEFAULT 60,
    an_min_chapter_bytes        INTEGER NOT NULL DEFAULT 1024,
    an_chapter_fail_threshold   REAL    NOT NULL DEFAULT 0.05
);

-- 站点规则（每站一行）
CREATE TABLE IF NOT EXISTS websites (
    key                     TEXT PRIMARY KEY,  -- 域名 key（如 "site_a"）
    enabled                 INTEGER NOT NULL DEFAULT 1,
    domain_name             TEXT    NOT NULL DEFAULT '',
    release_date            TEXT    NOT NULL DEFAULT '',
    release_url             TEXT    NOT NULL DEFAULT '',
    list_novel_name         TEXT    NOT NULL DEFAULT '',
    novel_content           TEXT    NOT NULL DEFAULT '',
    novel_name_x            TEXT    NOT NULL DEFAULT '',
    chapter_url_x           TEXT    NOT NULL DEFAULT '',
    page_list               TEXT    NOT NULL DEFAULT '[]',  -- JSON
    special_mode            TEXT    NOT NULL DEFAULT 'normal',
    novel_content_fallbacks TEXT    NOT NULL DEFAULT '[]'   -- JSON
);

-- AI config（已存在，合并到同一 DB）
CREATE TABLE IF NOT EXISTS ai_config (
    id          INTEGER PRIMARY KEY DEFAULT 1,
    enabled     INTEGER NOT NULL DEFAULT 0,
    provider    TEXT    NOT NULL DEFAULT 'deepseek',
    base_url    TEXT    NOT NULL DEFAULT '',
    api_key     TEXT    NOT NULL DEFAULT '',
    model       TEXT    NOT NULL DEFAULT '',
    max_tokens  INTEGER NOT NULL DEFAULT 2048,
    temperature REAL    NOT NULL DEFAULT 0.2
);

-- 首次运行标记
CREATE TABLE IF NOT EXISTS app_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
-- 示例：INSERT OR IGNORE INTO app_meta VALUES ('setup_complete', '0');
```

---

## 三、后端实现任务

### 3.1 新建 `src-tauri/src/config_db.rs`
- `open_db(app_data_dir)` — 打开 `{appDataDir}/txtx/app.db`，执行 migrate
- `migrate(conn)` — 建表 SQL（含 websites、ai_config、app_meta）
- `load_config(app_data_dir)` → `Result<AppConfig>`
- `save_config(app_data_dir, &AppConfig)` → `Result<()>`
- `is_first_run(app_data_dir)` → `bool`（检查 app_meta.setup_complete != '1'）
- `mark_setup_complete(app_data_dir)` → `Result<()>`
- `load_websites(conn)` → `HashMap<String, WebsiteConfig>`
- `save_website(conn, key, &WebsiteConfig)` → `Result<()>`
- `delete_website(conn, key)` → `Result<()>`

### 3.2 修改 `src-tauri/src/config.rs`
- 保留 `load_config()` / `save_config()` 签名（向后兼容现有 commands）
- 内部改为调用 `config_db::load_config`
- 迁移逻辑：首次启动时检测旧 `config.yml` 是否存在，若存在则导入到 DB，然后重命名为 `config.yml.bak`

### 3.3 修改 `src-tauri/src/lib.rs`
- 新增 Tauri command：`check_first_run() -> bool`
- 新增 Tauri command：`complete_setup(base_dir: String) -> Result<(), String>`
  - 写入 paths.base_dir 到 DB
  - 导入旧 config.yml（如存在）
  - 写 app_meta.setup_complete = '1'
- 修改 `load_config` / `save_config` commands 使用新的 DB 路径（从 `app.handle().path().app_data_dir()` 获取）

### 3.4 合并 `ai_config_db.rs`
- `ai_config_db::open_db` 改为使用同一个 `{appDataDir}/txtx/app.db`
- migrate 中包含 ai_config 表

---

## 四、前端任务

### 4.1 新增 `src/components/onboarding/SetupWizard.tsx`

首次运行向导，3 步：

**第 1 步 — 欢迎**
- 大标题 + 简短描述（书卷气文案）
- 无操作，仅有"开始设置"按钮

**第 2 步 — 选择下载目录**
- 说明文字：这里的书都会放进去
- 目录选择器（Tauri `open dialog` 或手动输入）
- 显示预览路径
- "继续"按钮

**第 3 步 — 完成**
- 确认信息展示
- "开始使用"按钮，调用 `complete_setup(baseDir)`，然后导航到 `/`

设计要点：
- 全屏覆盖层，居中卡片（`--radius-xl`）
- 3 个步骤用小圆点指示，当前步 accent 色
- 入场动画：fadeInUp，每步切换时 x 方向 slide
- 不用 Modal —— 这是应用启动时的专属流程，不应用 Modal 组件

### 4.2 修改 `src/layouts/RootLayout.tsx`
- `loadConfig()` 之前先调用 `check_first_run()`
- 若是首次运行，渲染 `<SetupWizard />` 覆盖层
- 设置完成后 `setFirstRun(false)`，正常加载 config

### 4.3 各页面空状态

**下载页（无站点配置时）**
- 当 `websites` 为空对象时显示空状态
- 图标：BookOpen，文案："还没有配置站点，先去添加一个"
- CTA：跳转 `/websites`

**网站页（空列表）**
- 图标：Globe，文案："添加第一个站点，从这里开始下载"
- CTA：触发 RuleWizard

**历史页（空列表）**
- 图标：BookMarked，文案："下载完的书都会出现在这里"
- 无 CTA（无需引导）

### 4.4 修改 `src/lib/api/config.ts`
- `apiCheckFirstRun()` — IS_TAURI 时调用 `check_first_run` invoke，否则返回 false
- `apiCompleteSetup(baseDir)` — 调用 `complete_setup` invoke

---

## 五、执行顺序

```
Phase 1 — 后端 DB
  [1] 新建 src-tauri/src/config_db.rs（完整实现）
  [2] 修改 src-tauri/src/config.rs（调用 config_db）
  [3] 修改 src-tauri/src/lib.rs（新增 commands，传递 app_data_dir）
  [4] 合并 ai_config_db.rs 到同一 DB（更新 open_db 路径）
  [5] 编译验证

Phase 2 — 前端引导流程
  [6] 新增 src/components/onboarding/SetupWizard.tsx
  [7] 修改 src/layouts/RootLayout.tsx（集成首次运行检测）
  [8] 新增 src/lib/api/config.ts 的新方法

Phase 3 — 空状态
  [9] 下载页空状态（websites 为空时）
  [10] 网站页空状态
  [11] 历史页空状态

Phase 4 — 验证
  [12] cargo build 验证后端
  [13] npm run build 验证前端
```

---

## 六、onboard 设计规范（impeccable onboard）

**物理场景：** 用户刚下载安装，在家里坐下来，第一次打开软件，灯光柔和，期待用它来追几本小说。他们不想读文档，只想快点进入正题。

**设计原则：**
- 3 步内完成，不超过 3 步
- 每步只有一个操作焦点
- 文案口语化：「把书放在哪里？」而不是「请选择下载目录」
- 完成时有一点小小的庆祝感（scale 动画 + checkmark）
- 空状态不用「暂无数据」，要有下一步指引

**色彩：** Restrained，accent 只用在 CTA 和当前步指示点上，背景保持暖米白。

**动效：**
- 步骤切换：`x: 20 → 0`，`opacity: 0 → 1`，easeOutQuart 180ms
- 完成 checkmark：scale 0.5→1，easeOutBack 200ms（唯一允许用 back 的地方）
- 整个向导卡片入场：fadeInUp，translateY 16→0，200ms

---

## 七、迁移兼容性

- 检测 `config.yml` 存在 → 自动导入 → 重命名为 `.bak`
- 用户无感知，不需要手动迁移
- `config.yml.bak` 保留供回滚（文档告知用户可手动删除）

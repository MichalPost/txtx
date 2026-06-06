# Rate Limit Rules 通用化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `ttks` 专用限速配置重构为通用的 `rate_limit_rules` 列表，每条规则独立配置 domains / delay / rps / ua_pool，任意站点均可按需添加反爬策略。

**Architecture:**
后端 Rust 侧：`TtksConfig` → `RateLimitConfig`（含 `Vec<RateLimitRule>`），`rate_limiter` 从全局单例变为 per-rule HashMap；`is_ttks_url` → `find_rate_limit_rule` 返回匹配的 rule。DB 侧用新表 `rate_limit_rules` 存储，旧 `ttks_*` 列保留（触发软迁移）。前端侧：新增 `RateLimitRulesSection` 组件（列表增删）替代 `TtksSection`，`AppConfig` 类型同步更新。YAML/config.yml 中的 `ttks` key 通过 serde 别名兼容，DB 自动迁移旧行。

**Tech Stack:** Rust + rusqlite + serde (后端) / React 19 + TypeScript + Zustand + react-hook-form + lucide-react (前端)

---

## 任务概览

| # | 层 | 内容 |
|---|----|----|
| 1 | Rust 模型 | 新增 `RateLimitRule` / `RateLimitConfig`，保留向后兼容 |
| 2 | Rust 下载器 | `ttks_downloader.rs` 函数签名 + 逻辑改用新类型 |
| 3 | Rust DB | 新表 `rate_limit_rules` + 软迁移旧 `ttks_*` 列 |
| 4 | Rust `AppConfig` | 替换 `ttks` 字段 |
| 5 | 前端类型 | `types/index.ts` |
| 6 | 前端 Schema | `settingsSchema.ts` 移除旧字段 |
| 7 | 前端 UI | `RateLimitRulesSection.tsx` 列表增删 |
| 8 | 前端设置页 | `SettingsPage.tsx` 替换 `TtksSection` |
| 9 | 构建验证 | `pnpm build --mode development` + `cargo check` |

---

## Task 1: Rust 模型层 — 新增 RateLimitRule / RateLimitConfig

**Files:**
- Modify: `src-tauri/src/models/filters.rs`
- Modify: `src-tauri/src/models/config.rs`

### Step 1: 在 `filters.rs` 中新增 `RateLimitRule` 和 `RateLimitConfig`，保留旧 `TtksConfig`（加 `#[allow(dead_code)]` 让编译通过直到 Task 4 删除）

将 `TtksConfig` 相关代码**替换**为：

```rust
// ─── RateLimitRule / RateLimitConfig ──────────────────────────────────────────

/// 单条站点限速规则（任意站点均可添加）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitRule {
    /// 规则名称（显示用）
    #[serde(default)]
    pub name: String,
    /// 命中此规则的域名特征列表（URL contains any）
    #[serde(default)]
    pub domains: Vec<String>,
    /// 章节间最小延迟（毫秒）；0 = 不延迟
    #[serde(default = "default_rl_delay_min")]
    pub delay_min_ms: u64,
    /// 章节间最大延迟（毫秒）；等于 delay_min_ms 时为固定延迟
    #[serde(default = "default_rl_delay_max")]
    pub delay_max_ms: u64,
    /// 每秒最大请求数；0 = 禁用（退回随机延迟）
    #[serde(default)]
    pub requests_per_second: u32,
    /// 随机 UA 池（空 = 使用全局 user_agent）
    #[serde(default)]
    pub ua_pool: Vec<String>,
    /// 启用 stealth TLS 指纹（wreq）；false = 标准 reqwest
    #[serde(default = "default_true_bool")]
    pub stealth: bool,
}

fn default_rl_delay_min() -> u64 { 1_000 }
fn default_rl_delay_max() -> u64 { 3_000 }
fn default_true_bool() -> bool { true }

impl Default for RateLimitRule {
    fn default() -> Self {
        Self {
            name: String::new(),
            domains: vec![],
            delay_min_ms: default_rl_delay_min(),
            delay_max_ms: default_rl_delay_max(),
            requests_per_second: 0,
            ua_pool: vec![],
            stealth: true,
        }
    }
}

/// 全部站点限速规则（替代原 TtksConfig）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RateLimitConfig {
    /// 规则列表，按顺序匹配，命中第一条即停
    #[serde(default)]
    pub rules: Vec<RateLimitRule>,
}

/// 向后兼容：从旧 ttks yaml/json 迁移
#[allow(dead_code)]
pub fn ttks_to_rate_limit(domains: Vec<String>, delay_min: u64, delay_max: u64,
    rps: u32, ua_pool: Vec<String>) -> RateLimitConfig {
    if domains.is_empty() && ua_pool.is_empty() {
        return RateLimitConfig::default();
    }
    RateLimitConfig {
        rules: vec![RateLimitRule {
            name: "TTKS（迁移）".into(),
            domains,
            delay_min_ms: delay_min,
            delay_max_ms: delay_max,
            requests_per_second: rps,
            ua_pool,
            stealth: true,
        }],
    }
}
```

同时**删除**整个旧 `TtksConfig` 块（从 `// ─── TtksConfig` 注释到 `impl Default for TtksConfig { ... }`）。

### Step 2: 更新 `config.rs` 的 import

```rust
// 旧
use crate::models::filters::{ContentFilterConfig, TtksConfig, AdvancedNetworkConfig};
// 新
use crate::models::filters::{ContentFilterConfig, RateLimitConfig, AdvancedNetworkConfig};
```

在 `AppConfig` 中替换字段：

```rust
// 旧
pub ttks: TtksConfig,
// 新
#[serde(alias = "ttks")]   // 读旧 YAML 时不报错（但无法自动转换，由 DB 迁移处理）
pub rate_limit: RateLimitConfig,
```

在 `default_app_config()` 中同步改字段名（Task 3 完成后一并处理）。

### Step 3: `cargo check` 确认编译

```bash
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | head -60
```

预期：看到一批 `ttks` 相关错误（Task 2/3/4 会逐步修复），**无**语法错误。

---

## Task 2: Rust 下载器 — 适配新类型

**Files:**
- Modify: `src-tauri/src/ttks_downloader.rs`
- Modify: `src-tauri/src/downloader/novel.rs`
- Modify: `src-tauri/src/downloader/mod.rs`（如有直接引用）

### Step 1: 重命名 `ttks_downloader.rs` → `rate_limiter.rs`（可选，也可保留文件名）

为了减少风险，**保留文件名** `ttks_downloader.rs`，只改内部函数签名和注释。

### Step 2: 替换 `ttks_downloader.rs` 中的类型引用

**2a. 函数 `is_ttks_url` → `find_rate_limit_rule`**

```rust
/// 查找 URL 匹配的第一条限速规则；未匹配时返回 None（走标准下载路径）
pub fn find_rate_limit_rule<'a>(
    url: &str,
    cfg: &'a crate::models::RateLimitConfig,
) -> Option<&'a crate::models::filters::RateLimitRule> {
    cfg.rules.iter().find(|r| {
        !r.domains.is_empty() && r.domains.iter().any(|d| url.contains(d.as_str()))
    })
}
```

保留旧 `is_ttks_url` 作为别名（防止其他地方漏改），加 `#[allow(dead_code)]`：

```rust
#[allow(dead_code)]
pub fn is_ttks_url(url: &str, cfg: &crate::models::RateLimitConfig) -> bool {
    find_rate_limit_rule(url, cfg).is_some()
}
```

**2b. 函数 `build_ttks_client` — 参数改为 `&RateLimitRule`**

```rust
pub fn build_ttks_client(
    proxy: Option<&str>,
    timeout: u64,
    rule: &crate::models::filters::RateLimitRule,   // 改这里
) -> Result<TtksClient> {
    let idx = rand::thread_rng().gen_range(0..rule.ua_pool.len().max(1));
    let ua = rule.ua_pool.get(idx).map(|s| s.as_str()).unwrap_or(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    );
    // stealth 判断改为读 rule.stealth
    #[cfg(feature = "stealth")]
    if rule.stealth {
        match stealth_client::build(ua, proxy, timeout) {
            Ok(client) => {
                tracing::debug!("RateLimit: stealth client (UA: {})", &ua[..ua.len().min(40)]);
                return Ok(TtksClient::Stealth(client));
            }
            Err(e) => {
                tracing::warn!("RateLimit: wreq failed ({}), falling back to reqwest", e);
            }
        }
    }
    // 其余 reqwest fallback 代码不变……
}
```

**2c. 函数 `fetch_ttks_chapter` — 参数改为 `&RateLimitRule`**

```rust
pub async fn fetch_ttks_chapter(
    client: &TtksClient,
    url: &str,
    domain: &str,
    content_xpath: &str,
    xpath_fallbacks: &[String],
    encoding_map: &HashMap<String, String>,
    retry_count: u32,
    retry_delay: u64,
    rule: &crate::models::filters::RateLimitRule,   // 改这里
    filter: &crate::models::ContentFilterConfig,
) -> Result<String> {
    // 限速逻辑改读 rule.requests_per_second / rule.delay_min_ms / rule.delay_max_ms
    if let Some(rl) = get_rate_limiter(rule.requests_per_second) {
        rl.until_ready().await;
    } else {
        let delay_ms = if rule.delay_max_ms > rule.delay_min_ms {
            rand::thread_rng().gen_range(rule.delay_min_ms..rule.delay_max_ms)
        } else {
            rule.delay_min_ms
        };
        sleep(Duration::from_millis(delay_ms)).await;
    }
    // 其余不变……
}
```

**注意：** `get_rate_limiter` 的全局 OnceLock 设计只适合单一 rps 值。多 rule 时需要 per-rule limiter。改为 `DashMap<u32, DirectRl>`（或 `HashMap` + `RwLock`）：

```rust
use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};

fn get_rate_limiter(rps: u32) -> Option<std::sync::Arc<DirectRl>> {
    static LIMITERS: OnceLock<RwLock<HashMap<u32, std::sync::Arc<DirectRl>>>> = OnceLock::new();
    if rps == 0 { return None; }
    let map = LIMITERS.get_or_init(|| RwLock::new(HashMap::new()));
    // fast path: read lock
    {
        let r = map.read().unwrap();
        if let Some(rl) = r.get(&rps) {
            return Some(rl.clone());
        }
    }
    // slow path: write lock
    let mut w = map.write().unwrap();
    let rl = w.entry(rps).or_insert_with(|| {
        let n = NonZeroU32::new(rps).unwrap_or(NonZeroU32::new(1).unwrap());
        std::sync::Arc::new(RateLimiter::direct(Quota::per_second(n)))
    });
    Some(rl.clone())
}
```

并把 `rl.until_ready().await` 改为 `rl.until_ready().await`（Arc deref 自动）。

### Step 3: 更新 `downloader/novel.rs` 中的调用点

找到所有调用 `is_ttks_url` / `build_ttks_client` / `fetch_ttks_chapter` 的地方，把传入的 `&ttks_cfg: TtksConfig` 改为 `&rate_limit: RateLimitConfig`：

```rust
// 旧
let text = if crate::ttks_downloader::is_ttks_url(&url, &ttks_cfg) {
    let proxy_opt = proxy.as_deref().filter(|p| !p.is_empty());
    match crate::ttks_downloader::build_ttks_client(proxy_opt, timeout, &ttks_cfg) {
        Ok(ttks_client) => {
            crate::ttks_downloader::fetch_ttks_chapter(
                &ttks_client, &url, &domain,
                &xpath, &xpath_fallbacks, &enc, rc, rd, &ttks_cfg, &content_filter,
            ).await?
        }
        ...
    }
};

// 新
let text = if let Some(rule) = crate::ttks_downloader::find_rate_limit_rule(&url, &rate_limit_cfg) {
    let proxy_opt = proxy.as_deref().filter(|p| !p.is_empty());
    let rule = rule.clone();   // clone 出来传入 async block
    match crate::ttks_downloader::build_ttks_client(proxy_opt, timeout, &rule) {
        Ok(rl_client) => {
            crate::ttks_downloader::fetch_ttks_chapter(
                &rl_client, &url, &domain,
                &xpath, &xpath_fallbacks, &enc, rc, rd, &rule, &content_filter,
            ).await?
        }
        ...
    }
};
```

同时把 novel.rs 中的 `cfg_ttks: crate::models::TtksConfig` 参数改为 `cfg_rate_limit: crate::models::RateLimitConfig`，变量名 `ttks_cfg` → `rate_limit_cfg`。

### Step 4: 更新 `downloader/mod.rs`（或 `commands.rs`）中传参

搜索 `config.ttks` 并改为 `config.rate_limit`。

### Step 5: `cargo check`

```bash
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | head -80
```

预期：只剩 DB 层错误（Task 3 修复）。

---

## Task 3: Rust DB — 新表 + 软迁移

**Files:**
- Modify: `src-tauri/src/config_db.rs`

### Step 1: `migrate()` 函数中新增 `rate_limit_rules` 表

在 `migrate` 函数的 `conn.execute_batch(...)` SQL 末尾追加：

```sql
CREATE TABLE IF NOT EXISTS rate_limit_rules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    name        TEXT    NOT NULL DEFAULT '',
    domains     TEXT    NOT NULL DEFAULT '[]',
    delay_min   INTEGER NOT NULL DEFAULT 1000,
    delay_max   INTEGER NOT NULL DEFAULT 3000,
    rps         INTEGER NOT NULL DEFAULT 0,
    ua_pool     TEXT    NOT NULL DEFAULT '[]',
    stealth     INTEGER NOT NULL DEFAULT 1
);
```

### Step 2: 软迁移函数 — 把旧 `ttks_*` 列转换为一条规则

在 `open_db` 返回前，调用一次迁移：

```rust
fn migrate_ttks_to_rules(conn: &Connection) -> Result<()> {
    // 只迁移一次
    let already: i64 = conn
        .query_row("SELECT COUNT(*) FROM rate_limit_rules", [], |r| r.get(0))
        .unwrap_or(0);
    if already > 0 { return Ok(()); }

    // 读旧字段
    let row: rusqlite::Result<(String, i64, i64, i32, String)> = conn.query_row(
        "SELECT ttks_domains, ttks_delay_min, ttks_delay_max, 0, ttks_ua_pool
         FROM app_config WHERE id = 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
    );
    let Ok((domains_json, delay_min, delay_max, _rps, ua_pool_json)) = row else {
        return Ok(()); // no config row yet, skip
    };
    // 只在域名或 UA 有内容时才插入
    let domains: Vec<String> = serde_json::from_str(&domains_json).unwrap_or_default();
    let ua_pool: Vec<String> = serde_json::from_str(&ua_pool_json).unwrap_or_default();
    if domains.is_empty() && ua_pool.is_empty() { return Ok(()); }

    conn.execute(
        "INSERT INTO rate_limit_rules (sort_order, name, domains, delay_min, delay_max, rps, ua_pool, stealth)
         VALUES (0, 'TTKS（迁移）', ?1, ?2, ?3, 0, ?4, 1)",
        params![domains_json, delay_min, delay_max, ua_pool_json],
    )?;
    Ok(())
}
```

在 `open_db` 的 `migrate(&conn)?;` 之后调用：`let _ = migrate_ttks_to_rules(&conn);`

### Step 3: `load_config` — 读取 `rate_limit_rules` 表

替换旧的 `ttks_*` 读取逻辑。在 `row_to_config` 函数中**删除** `ttks_*` 相关列读取（列 37–40），并在 `load_config` 末尾单独加载规则：

```rust
fn load_rate_limit_rules(conn: &Connection) -> Vec<crate::models::filters::RateLimitRule> {
    let Ok(mut stmt) = conn.prepare(
        "SELECT name, domains, delay_min, delay_max, rps, ua_pool, stealth
         FROM rate_limit_rules ORDER BY sort_order ASC"
    ) else { return vec![]; };

    let rows = stmt.query_map([], |row| {
        let name: String = row.get(0)?;
        let domains_json: String = row.get(1)?;
        let delay_min: u64 = row.get::<_, i64>(2)? as u64;
        let delay_max: u64 = row.get::<_, i64>(3)? as u64;
        let rps: u32 = row.get::<_, i64>(4)? as u32;
        let ua_pool_json: String = row.get(5)?;
        let stealth: bool = row.get::<_, i64>(6)? != 0;
        let domains = serde_json::from_str(&domains_json).unwrap_or_default();
        let ua_pool = serde_json::from_str(&ua_pool_json).unwrap_or_default();
        Ok(crate::models::filters::RateLimitRule {
            name, domains, delay_min_ms: delay_min, delay_max_ms: delay_max,
            requests_per_second: rps, ua_pool, stealth,
        })
    });
    rows.ok()
        .map(|iter| iter.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}
```

在 `load_config` 的 `Ok(mut cfg)` 分支加：`cfg.rate_limit.rules = load_rate_limit_rules(&conn);`

同时更新 `SELECT` 语句中的列列表——**移除** `ttks_domains, ttks_delay_min, ttks_delay_max, ttks_ua_pool`（但保留这些列在表中以防旧版回滚），在 `row_to_config` 中移除对应的列索引和变量。

> **注意：** `row_to_config` 中列索引是硬编码的数字，删除 4 列后从第 37 列往后的 `an_*` 索引要相应调整（37→37，38→38，39→39，40→40 变为 37→33，38→34，39→35，40→36）。

### Step 4: `save_config` — 写入 `rate_limit_rules` 表

删除旧 `ttks_domains` / `ttks_ua_pool` 序列化和 SQL 中的 `ttks_*` 列。新增 `save_rate_limit_rules` 调用：

```rust
fn save_rate_limit_rules(conn: &Connection, rules: &[crate::models::filters::RateLimitRule]) -> Result<()> {
    conn.execute("DELETE FROM rate_limit_rules", [])?;
    for (i, rule) in rules.iter().enumerate() {
        let domains_json = serde_json::to_string(&rule.domains)?;
        let ua_pool_json = serde_json::to_string(&rule.ua_pool)?;
        conn.execute(
            "INSERT INTO rate_limit_rules (sort_order, name, domains, delay_min, delay_max, rps, ua_pool, stealth)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                i as i64, rule.name, domains_json,
                rule.delay_min_ms as i64, rule.delay_max_ms as i64,
                rule.requests_per_second as i64,
                ua_pool_json, rule.stealth as i64,
            ],
        )?;
    }
    Ok(())
}
```

在 `save_config` 末尾（`save_all_websites_inner` 之后）加：`save_rate_limit_rules(&conn, &config.rate_limit.rules)?;`

并更新主 INSERT/UPDATE SQL（移除 `ttks_*` 相关绑定参数，同步调整 `?N` 编号）。

### Step 5: `default_app_config()` — 更新字段名

```rust
// 旧
ttks: TtksConfig::default(),
// 新
rate_limit: RateLimitConfig::default(),
```

### Step 6: `cargo check`

```bash
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | head -60
```

预期：0 错误。

---

## Task 4: 前端类型 — `types/index.ts`

**Files:**
- Modify: `src/types/index.ts`

### Step 1: 替换 `TtksConfig`，新增 `RateLimitRule` / `RateLimitConfig`

删除：
```typescript
export interface TtksConfig {
  domains: string[];
  delay_min_ms: number;
  delay_max_ms: number;
  ua_pool: string[];
}
```

新增：
```typescript
export interface RateLimitRule {
  name: string;
  domains: string[];
  delay_min_ms: number;
  delay_max_ms: number;
  requests_per_second: number;
  ua_pool: string[];
  stealth: boolean;
}

export interface RateLimitConfig {
  rules: RateLimitRule[];
}
```

### Step 2: 更新 `AppConfig` 接口

```typescript
// 旧
ttks: TtksConfig;
// 新
rate_limit: RateLimitConfig;
```

---

## Task 5: 前端 Schema — `settingsSchema.ts`

**Files:**
- Modify: `src/pages/settings/settingsSchema.ts`

### Step 1: 移除 TTKS 字段，新增 `rate_limit_rules`

在 `settingsSchema` 中删除：
```typescript
ttks_domains: z.string(),
ttks_delay_min: z.coerce.number().int().min(0),
ttks_delay_max: z.coerce.number().int().min(0),
ttks_ua_pool: z.string(),
```

新增（把整个规则列表作为 JSON 数组字段，由 UI 组件直接管理，不走 rhf 字段逐个验证，保持 schema 简洁）：

```typescript
rate_limit_rules: z.array(z.object({
  name: z.string(),
  domains: z.string(),           // 多行文本，用 \n 分隔，转换时 split
  delay_min_ms: z.coerce.number().int().min(0),
  delay_max_ms: z.coerce.number().int().min(0),
  requests_per_second: z.coerce.number().int().min(0),
  ua_pool: z.string(),           // 多行文本
  stealth: z.boolean(),
})),
```

### Step 2: 更新 `configToForm`

删除旧 `ttks_*` 字段，新增：

```typescript
rate_limit_rules: (config.rate_limit?.rules ?? []).map(r => ({
  name: r.name,
  domains: r.domains.join("\n"),
  delay_min_ms: r.delay_min_ms,
  delay_max_ms: r.delay_max_ms,
  requests_per_second: r.requests_per_second,
  ua_pool: r.ua_pool.join("\n"),
  stealth: r.stealth,
})),
```

### Step 3: 更新 `formToConfig`

删除旧 `ttks` 块，新增：

```typescript
rate_limit: {
  rules: form.rate_limit_rules.map(r => ({
    name: r.name,
    domains: r.domains.split("\n").map((l: string) => l.trimEnd()).filter(Boolean),
    delay_min_ms: r.delay_min_ms,
    delay_max_ms: r.delay_max_ms,
    requests_per_second: r.requests_per_second,
    ua_pool: r.ua_pool.split("\n").map((l: string) => l.trimEnd()).filter(Boolean),
    stealth: r.stealth,
  })),
},
```

---

## Task 6: 前端 UI — `RateLimitRulesSection.tsx`

**Files:**
- Create: `src/pages/settings/sections/RateLimitRulesSection.tsx`
- Delete: `src/pages/settings/sections/TtksSection.tsx`（Task 8 中一起处理）

### Step 1: 创建 `RateLimitRulesSection.tsx`

组件使用 `useFieldArray` 管理规则列表，每条规则展开为可折叠的编辑面板。

```tsx
import { useFieldArray, useFormContext } from "react-hook-form";
import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { FieldError, FormTextarea } from "../SettingsFields";
import type { SettingsForm } from "../settingsSchema";

const DEFAULT_RULE = {
  name: "新规则",
  domains: "",
  delay_min_ms: 1000,
  delay_max_ms: 3000,
  requests_per_second: 0,
  ua_pool: "",
  stealth: true,
};

export function RateLimitRulesSection() {
  const { control, register, formState: { errors } } = useFormContext<SettingsForm>();
  const { fields, append, remove } = useFieldArray({ control, name: "rate_limit_rules" });
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (i: number) =>
    setExpanded(prev => ({ ...prev, [i]: !prev[i] }));

  return (
    <Card title="请求限速规则">
      <div className="flex flex-col gap-3">
        <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
          为任意站点配置独立的反爬限速策略（延迟、UA 轮换、TLS 指纹）。URL 命中第一条匹配规则即应用。
        </p>

        {fields.length === 0 && (
          <p className="text-xs text-center py-3" style={{ color: "var(--color-text-subtle)" }}>
            暂无规则，点击下方按钮添加
          </p>
        )}

        {fields.map((field, i) => {
          const isOpen = !!expanded[i];
          const errs = (errors.rate_limit_rules as any)?.[i];
          return (
            <div
              key={field.id}
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: "var(--color-border)" }}
            >
              {/* Header row */}
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                style={{ background: "var(--color-surface-1)" }}
                onClick={() => toggle(i)}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
                <span className="flex-1 text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>
                  {field.name || `规则 ${i + 1}`}
                </span>
                <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                  {field.domains ? field.domains.split("\n").filter(Boolean).join(", ") : "（无域名）"}
                </span>
                {isOpen
                  ? <ChevronUp className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                  : <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                }
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(i); }}
                  className="p-1 rounded-md hover:opacity-70"
                  style={{ color: "var(--color-danger)" }}
                  title="删除规则"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Expanded body */}
              {isOpen && (
                <div
                  className="flex flex-col gap-3 p-3 border-t"
                  style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                >
                  <Input label="规则名称" {...register(`rate_limit_rules.${i}.name`)} />

                  <FormTextarea
                    rows={3}
                    label="匹配域名（每行一条，URL 包含任意一条即命中）"
                    field={`rate_limit_rules.${i}.domains` as any}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Input
                        label="最小延迟（毫秒）"
                        type="number"
                        {...register(`rate_limit_rules.${i}.delay_min_ms`)}
                      />
                      <FieldError msg={errs?.delay_min_ms?.message} />
                    </div>
                    <div>
                      <Input
                        label="最大延迟（毫秒）"
                        type="number"
                        {...register(`rate_limit_rules.${i}.delay_max_ms`)}
                      />
                      <FieldError msg={errs?.delay_max_ms?.message} />
                    </div>
                  </div>

                  <div>
                    <Input
                      label="每秒最大请求数（0 = 使用随机延迟）"
                      type="number"
                      {...register(`rate_limit_rules.${i}.requests_per_second`)}
                    />
                    <FieldError msg={errs?.requests_per_second?.message} />
                  </div>

                  <FormTextarea
                    rows={4}
                    label="User-Agent 池（每行一条，随机轮换；空 = 使用全局 UA）"
                    field={`rate_limit_rules.${i}.ua_pool` as any}
                  />

                  <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: "var(--color-text)" }}>
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5"
                      {...register(`rate_limit_rules.${i}.stealth`)}
                    />
                    <span>启用 Stealth TLS 指纹（绕过 JA3/JA4 反爬，需 stealth feature 编译）</span>
                  </label>
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            append(DEFAULT_RULE);
            // Auto-expand the new rule
            setExpanded(prev => ({ ...prev, [fields.length]: true }));
          }}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-dashed text-xs"
          style={{
            borderColor: "var(--color-border-hover)",
            color: "var(--color-text-muted)",
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          添加限速规则
        </button>
      </div>
    </Card>
  );
}
```

---

## Task 7: 前端设置页 — 替换 TtksSection

**Files:**
- Modify: `src/pages/settings/SettingsPage.tsx`
- Delete: `src/pages/settings/sections/TtksSection.tsx`

### Step 1: 更新 `SettingsPage.tsx`

```tsx
// 删除
import { TtksSection } from "./sections/TtksSection";
// 新增
import { RateLimitRulesSection } from "./sections/RateLimitRulesSection";

// JSX 中替换
// <TtksSection />  →  <RateLimitRulesSection />
```

### Step 2: 删除 `TtksSection.tsx`

```bash
del src\pages\settings\sections\TtksSection.tsx
```

---

## Task 8: 构建验证

**No new files.**

### Step 1: TypeScript / Vite 构建

```bash
pnpm run build --mode development
```

预期：0 TS 错误，0 构建错误。

### Step 2: Rust 编译检查

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

预期：0 错误，警告可忽略。

### Step 3: 修复所有剩余错误后 commit

```bash
git add -A
git commit -m "refactor: replace ttks-specific config with generic rate_limit_rules list

- Backend: TtksConfig -> RateLimitConfig (Vec<RateLimitRule>)
- DB: new rate_limit_rules table, auto-migrate existing ttks_* data
- Downloader: find_rate_limit_rule() replaces is_ttks_url(), per-rule rate limiter
- Frontend: RateLimitRulesSection replaces TtksSection, supports add/remove rules
- Any site can now have its own delay/UA/stealth policy"
```

---

## 实现注意事项

1. **DB column 索引硬编码**：`row_to_config` 用数字列索引，删除 4 个 `ttks_*` 列后，`an_*` 列的索引从 `41–44` 变为 `37–40`。务必逐个核对。

2. **`requests_per_second` 不存 DB**：旧 schema 没有 `ttks_rps` 列（`row_to_config` 里硬编码为 `0`），新表 `rate_limit_rules` 已有 `rps` 列，正常存取。

3. **`filter_ttks_content_with_config` 函数名**：与 TTKS 同名，可保留（内容过滤逻辑和站点名无关），或改为 `filter_content_with_extra_rules`，两者均可，建议改名保持一致。

4. **YAML `ttks` 字段**：`AppConfig` 中的 `#[serde(alias = "ttks")]` 让旧 YAML 不报错，但旧结构无法自动转换为新的 `RateLimitConfig`（字段名不同）。这没关系，因为 DB 迁移已处理现有数据；YAML 路径只在首次迁移时用到。

5. **`FormTextarea` 的 `field` prop**：当前 `FormTextarea` 接受 `field: keyof SettingsForm` 字符串。嵌套字段 `rate_limit_rules.0.domains` 需要 `as any` cast（或改 FormTextarea 接受 string 类型），已在代码示例中标注。

# kumo 爬虫框架集成计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 kumo v0.3.14 的核心能力选择性集成到项目中，以替换或增强现有爬虫模块，重点解决 XPath 解析偏差、反爬绕过和限速精度三个实际问题。

**Architecture:** 不全量迁移到 kumo 框架模式（会破坏现有的两阶段 pipeline + 进度事件流 + 断点续传），而是将 kumo 作为工具库使用：用 `kumo::extract` 替换自写的 xpath→css 转换，用 kumo `stealth` feature 的 `wreq` 客户端处理反爬站点，用 kumo 的 `RateLimiter` 替换手写延迟。核心 `downloader.rs` 流程不变。

**Tech Stack:**
- `kumo = { version = "0.3", features = ["xpath", "stealth"] }` — XPath 提取 + TLS 指纹绕过
- `governor = "0.8"` — token-bucket 限速（kumo 内部依赖，直接暴露）
- `async-trait = "0.1"` — kumo Spider trait 要求（仅扫描阶段用）

---

## 集成策略说明（为什么不全量迁移）

kumo 是"框架驱动"模式：你实现 `Spider` trait，框架控制调度。你的项目是"工具箱模式"：`downloader.rs` 手动编排两阶段 pipeline（扫描→筛选→下载），维护进度事件流、断点续传队列持久化、章节修复 pass、合并、ebook 转换。

全量迁移到 kumo 的 `CrawlEngine::run()` 会丢失这些：
- 分阶段的 `ProgressEvent` 流（前端依赖）
- `download_queue.json` 断点续传
- 章节修复 pass（first_pass + repair_pass）
- 黑名单 + 去重 + 本地存在 三层过滤

因此，**只集成 kumo 的工具组件，保留现有 pipeline 骨架**。

---

## Task 1: 添加 kumo 依赖

**Files:**
- Modify: `txtx-app/src-tauri/Cargo.toml`

### Step 1: 在 [dependencies] 中添加 kumo

在 `backon = "1"` 之后加入：

```toml
kumo = { version = "0.3", features = ["xpath", "stealth"] }
async-trait = "0.1"
```

`xpath` feature 拉入 `sxd-document` + `sxd-xpath` + `sxd_html`，提供真正的 XPath 1.0 引擎。
`stealth` feature 拉入 `wreq` + `wreq-util`，提供 TLS 指纹伪造客户端（绕过 Cloudflare/反爬）。

### Step 2: 编译验证依赖可以拉取

```bash
cargo fetch 2>&1 | tail -5
```

期望：无 error，所有依赖被下载。

### Step 3: 确认 kumo 版本锁定

```bash
grep "^kumo" src-tauri/Cargo.lock | head -3
```

期望：看到 `kumo 0.3.x`。

### Step 4: 提交

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: add kumo dependency with xpath and stealth features"
```

---

## Task 2: 用 kumo XPath 引擎替换自写的 xpath→css 转换

**背景问题：** 现有 `xpath_to_css()` 把 XPath 转 CSS 选择器，存在多种失配：
- `//h1/text()` 等双斜杠路径解析不稳定
- `tag[n]` 转成 `:nth-of-type(n)` 在某些 HTML 结构里不等价
- 无法处理 `contains()`, `@class=` 等 XPath 谓词

kumo 的 `xpath` feature 使用 `sxd-xpath`，是完整的 XPath 1.0 引擎。

**Files:**
- Modify: `txtx-app/src-tauri/src/crawler.rs`


### Step 1: 在 crawler.rs 顶部添加 kumo Response import

在现有 `use` 语句块末尾添加：

```rust
use kumo::extract::response::Response as KumoResponse;
```

### Step 2: 新增 `xpath_texts_kumo` 函数

在 `xpath_texts_pub` 函数之后添加新函数：

```rust
/// 使用 kumo 的真实 XPath 1.0 引擎提取文本/属性值。
/// 比 xpath_to_css 转换更准确，支持完整 XPath 谓词。
/// html_str: 原始 HTML 字符串
/// xpath: XPath 表达式，如 "//p/text()" 或 "/html/body/div[4]/a/@href"
pub fn xpath_texts_native(html_str: &str, xpath: &str) -> Vec<String> {
    // 构造一个假 URL 仅供 kumo Response 使用（不发网络请求）
    let response = KumoResponse::from_html(
        "http://localhost/",
        html_str.to_string(),
    );
    match response.xpath(xpath) {
        Ok(elements) => {
            elements.iter()
                .map(|e| e.text().trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        }
        Err(_) => {
            // 降级到原有的 xpath_texts（css 模拟）
            let html = scraper::Html::parse_document(html_str);
            xpath_texts(&html, xpath)
        }
    }
}
```

### Step 3: 修改 `fetch_page` 后的调用点，改用 `xpath_texts_native`

找到 `scan_site` 函数中：

```rust
let html = Html::parse_document(&html_str);
let dates = xpath_texts(&html, &site_cfg.release_date);
let urls = xpath_texts(&html, &site_cfg.release_url);
let names = if !site_cfg.list_novel_name.is_empty() {
    xpath_texts(&html, &site_cfg.list_novel_name)
} else {
    vec![]
};
```

替换为：

```rust
let dates = xpath_texts_native(&html_str, &site_cfg.release_date);
let urls = xpath_texts_native(&html_str, &site_cfg.release_url);
let names = if !site_cfg.list_novel_name.is_empty() {
    xpath_texts_native(&html_str, &site_cfg.list_novel_name)
} else {
    vec![]
};
```

### Step 4: 同样修改 `get_chapter_urls` 和 `download_chapter` 中的 xpath_texts 调用

在 `get_chapter_urls` 中：
```rust
// 原来
let html = Html::parse_document(&html_str);
let raw_urls = xpath_texts(&html, chapter_url_xpath);
// 改为
let raw_urls = xpath_texts_native(&html_str, chapter_url_xpath);
```

在 `download_chapter` 中：
```rust
// 原来
let html = Html::parse_document(&html_str);
let primary = xpath_texts(&html, content_xpath);
// 改为
let primary = xpath_texts_native(&html_str, content_xpath);
// fallbacks 同理
for fallback_xpath in xpath_fallbacks {
    let parts = xpath_texts_native(&html_str, fallback_xpath.trim());
    ...
}
```

### Step 5: 编译验证

```bash
cargo build 2>&1 | grep -E "^error"
```

期望：无 error 输出。

### Step 6: 提交

```bash
git add src-tauri/src/crawler.rs
git commit -m "feat: use kumo native XPath engine instead of xpath-to-css conversion"
```

---

## Task 3: 用 wreq (kumo stealth) 替换 TTKS 专用客户端

**背景问题：** TTKS 站点（ttks.tw）疑似检测 TLS ClientHello 指纹（JA3/JA4），标准 `reqwest` 使用 rustls 发出的 TLS 握手特征容易被识别并返回 403。
`wreq`（kumo `stealth` feature 的底层）使用 BoringSSL 模拟 Chrome 的 TLS 指纹。

**Files:**
- Modify: `txtx-app/src-tauri/src/ttks_downloader.rs`


### Step 1: 在 ttks_downloader.rs 顶部添加 wreq import

在文件顶部，替换现有 `use reqwest::Client;` 为：

```rust
use wreq::Client;
use wreq_util::Emulation;
```

### Step 2: 替换 `build_ttks_client` 函数

找到现有的 `build_ttks_client` 函数，整体替换为：

```rust
/// 构造 TTKS 专用 HTTP 客户端，使用 wreq 模拟 Chrome TLS 指纹。
/// 可绕过基于 JA3/JA4 TLS 指纹的反爬检测。
pub fn build_ttks_client(proxy: Option<&str>, timeout: u64, ttks_cfg: &crate::models::TtksConfig) -> Result<Client> {
    // 随机选取 UA（wreq 会自动匹配对应的 TLS 指纹）
    let idx = rand::thread_rng().gen_range(0..ttks_cfg.ua_pool.len());
    let ua = &ttks_cfg.ua_pool[idx];

    // 选择模拟目标：Chrome 124 on Windows
    let emulation = if ua.contains("Edg") {
        Emulation::Edge127
    } else if ua.contains("Firefox") {
        Emulation::Firefox127
    } else {
        Emulation::Chrome127
    };

    let mut builder = Client::builder()
        .emulation(emulation)
        .timeout(std::time::Duration::from_secs(timeout));

    if let Some(p) = proxy {
        if !p.is_empty() {
            builder = builder.proxy(wreq::Proxy::all(p)?);
        }
    }
    Ok(builder.build()?)
}
```

### Step 3: 更新 `fetch_ttks_chapter` 签名

`fetch_ttks_chapter` 函数的 `client: &Client` 参数类型跟随变化（现在是 `wreq::Client`），其余逻辑不变，只需确保编译通过。

### Step 4: 更新 downloader.rs 中的调用

在 `downloader.rs` 的 TTKS 分支里，`build_ttks_client` 返回的已经是 `wreq::Client`，调用方式不变。

### Step 5: 编译验证

```bash
cargo build 2>&1 | grep -E "^error"
```

> 注意：`wreq` 依赖 BoringSSL，首次编译需要 cmake 和 C++ 工具链。如果 Windows 下缺少，`stealth` feature 先用 `reqwest` 回退，后续可以在 CI/发布时启用。

### Step 6: 提交

```bash
git add src-tauri/src/ttks_downloader.rs
git commit -m "feat: use wreq (Chrome TLS fingerprint) for TTKS stealth client"
```

---

## Task 4: 用 kumo RateLimiter 替换手写延迟

**背景：** 现有 TTKS 延迟是 `rand::thread_rng().gen_range(delay_min..delay_max)` 硬睡眠，精度低。kumo 内部使用 `governor` crate 的 token-bucket 算法，可以更精确地控制每秒请求数上限。

**Files:**
- Modify: `txtx-app/src-tauri/Cargo.toml` — 添加 governor 依赖
- Modify: `txtx-app/src-tauri/src/ttks_downloader.rs` — 改用 RateLimiter
- Modify: `txtx-app/src-tauri/src/models.rs` — 添加 rate_limit 配置字段

### Step 1: 添加 governor 依赖

在 `Cargo.toml` 的 `[dependencies]` 中添加：

```toml
governor = "0.8"
nonzero_ext = "0.3"
```

### Step 2: 在 models.rs 的 TtksConfig 中添加限速字段

在 `pub delay_max_ms: u64,` 之后添加：

```rust
/// 每秒最大请求数（0 = 不限制，使用 delay_min/max 随机延迟）
#[serde(default = "default_ttks_rps")]
pub requests_per_second: u32,
```

在文件末尾添加：
```rust
fn default_ttks_rps() -> u32 { 0 }
```

### Step 3: 在 ttks_downloader.rs 中实现 RateLimiter

在文件顶部添加：

```rust
use governor::{Quota, RateLimiter as GovernorRL};
use nonzero_ext::nonzero;
use std::num::NonZeroU32;
use std::sync::OnceLock;
```

新增全局 RateLimiter（懒初始化）：

```rust
/// 全局 TTKS 限速器，首次使用时初始化
fn get_rate_limiter(rps: u32) -> Option<&'static GovernorRL<
    governor::state::NotKeyed,
    governor::state::InMemoryState,
    governor::clock::DefaultClock,
>> {
    static RL: OnceLock<GovernorRL<
        governor::state::NotKeyed,
        governor::state::InMemoryState,
        governor::clock::DefaultClock,
    >> = OnceLock::new();
    if rps == 0 { return None; }
    let n = NonZeroU32::new(rps).unwrap_or(nonzero!(1u32));
    Some(RL.get_or_init(|| {
        GovernorRL::direct(Quota::per_second(n))
    }))
}
```

### Step 4: 修改 `fetch_ttks_chapter` 中的延迟逻辑

把现有的随机睡眠：

```rust
let delay_ms = rand::thread_rng().gen_range(3_000u64..8_000);
sleep(Duration::from_millis(delay_ms)).await;
```

替换为：

```rust
// 优先使用 token-bucket 限速（精确），fallback 到随机延迟
if let Some(rl) = get_rate_limiter(ttks_cfg.requests_per_second) {
    rl.until_ready().await;
} else {
    let delay_ms = rand::thread_rng().gen_range(
        ttks_cfg.delay_min_ms..ttks_cfg.delay_max_ms
    );
    sleep(Duration::from_millis(delay_ms)).await;
}
```

### Step 5: 编译验证

```bash
cargo build 2>&1 | grep -E "^error"
```

### Step 6: 提交

```bash
git add src-tauri/Cargo.toml src-tauri/src/models.rs src-tauri/src/ttks_downloader.rs
git commit -m "feat: use governor token-bucket rate limiter for TTKS request throttling"
```

---

## Task 5: 用 kumo HTTP cache 加速开发调试

**背景：** kumo 的 `http_cache(dir)` 可以把响应缓存到磁盘，后续相同 URL 直接从缓存返回，无需网络请求。这对开发阶段调试 XPath 规则非常有用。

这个功能只在"工具模式"下用，不在正式下载流程里。新增一个独立的 CLI 命令或测试函数。

**Files:**
- Create: `txtx-app/src-tauri/src/dev_tools.rs`（仅 cfg(debug_assertions) 下编译）
- Modify: `txtx-app/src-tauri/src/lib.rs` — 条件注册模块


### Step 1: 创建 dev_tools.rs

```rust
//! 开发调试工具模块（仅 debug build 编译）
//! 使用 kumo 的磁盘响应缓存来加速 XPath 规则调试，避免重复请求。

use anyhow::Result;
use kumo::prelude::*;
use kumo::engine::CrawlEngine;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DebugItem {
    pub url: String,
    pub matched: Vec<String>,
}

/// 用于调试单个页面的 XPath 提取结果。
/// 会把响应缓存到 cache_dir，后续调用相同 URL 无需网络。
pub async fn debug_xpath(
    url: &str,
    xpath: &str,
    cache_dir: &str,
) -> Result<Vec<String>> {
    struct DebugSpider {
        target_url: String,
        xpath: String,
    }

    #[async_trait::async_trait]
    impl Spider for DebugSpider {
        type Item = DebugItem;
        fn name(&self) -> &str { "debug" }
        fn start_urls(&self) -> Vec<String> { vec![self.target_url.clone()] }

        async fn parse(&self, response: &Response) -> Result<Output<Self::Item>, KumoError> {
            let matched = response.xpath(&self.xpath)
                .unwrap_or_default()
                .iter()
                .map(|e| e.text().trim().to_string())
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>();
            Output::new().item(DebugItem {
                url: response.url().to_string(),
                matched,
            })
        }
    }

    let spider = DebugSpider {
        target_url: url.to_string(),
        xpath: xpath.to_string(),
    };

    let mut items: Vec<DebugItem> = Vec::new();
    let mut stream = CrawlEngine::builder()
        .http_cache(cache_dir)?
        .respect_robots_txt(false)
        .stream(spider)
        .await?;

    use tokio_stream::StreamExt;
    while let Some(raw) = stream.next().await {
        if let Ok(item) = serde_json::from_str::<DebugItem>(&raw) {
            items.push(item);
        }
    }

    Ok(items.into_iter().flat_map(|i| i.matched).collect())
}
```

### Step 2: 在 lib.rs 中条件注册模块

在 `pub mod ttks_downloader;` 之后添加：

```rust
#[cfg(debug_assertions)]
pub mod dev_tools;
```

### Step 3: 在 Cargo.toml 中添加 tokio-stream 依赖

```toml
tokio-stream = "0.1"
```

### Step 4: 编译验证（debug 模式）

```bash
cargo build 2>&1 | grep -E "^error"
```

### Step 5: 提交

```bash
git add src-tauri/src/dev_tools.rs src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat: add debug_xpath dev tool with kumo HTTP cache for XPath rule iteration"
```

---

## Task 6: 扫描阶段并发站点改造（用 kumo multi-spider）

**背景：** 现有 `run_scan_and_filter` 中各站点是**串行**扫描的（`for site_cfg in &enabled_sites`），10 个站点就要顺序等待 10 轮网络请求。kumo 的 `add_spider + run_all()` 天然支持多 spider 并发，且共享连接池和中间件。

**注意：** 这里用 kumo 的 `run_all()` 只做**扫描阶段（列表页抓取）**，不替换下载阶段。扫描结果通过 `ItemStore` 或 channel 传回现有 pipeline。

**Files:**
- Create: `txtx-app/src-tauri/src/kumo_scanner.rs`
- Modify: `txtx-app/src-tauri/src/lib.rs` — 注册新模块
- Modify: `txtx-app/src-tauri/src/downloader.rs` — 在 `build_scan_items` 中使用新扫描器

### Step 1: 创建 kumo_scanner.rs

```rust
//! 使用 kumo multi-spider engine 并发扫描多个站点列表页。
//! 每个站点一个 Spider 实例，共享 CrawlEngine，结果通过 tokio channel 汇聚。

use anyhow::Result;
use async_trait::async_trait;
use kumo::prelude::*;
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::models::{BookCandidate, WebsiteConfig, NetworkConfig};
use crate::crawler::xpath_texts_native;

#[derive(Debug, Serialize, Clone)]
pub struct ScanItem {
    pub name: String,
    pub url: String,
    pub crawler_domain: String,
    pub date: String,
}

/// 单个站点的扫描 Spider。
struct SiteSpider {
    site: WebsiteConfig,
    target_date: String,
}

#[async_trait]
impl Spider for SiteSpider {
    type Item = ScanItem;

    fn name(&self) -> &str { &self.site.domain_name }

    fn start_urls(&self) -> Vec<String> {
        self.site.page_list.iter()
            .map(|p| format!("{}{}", self.site.domain_name, p))
            .collect()
    }

    fn allowed_domains(&self) -> Vec<&str> {
        // 限制只爬本站
        vec![self.site.domain_name.trim_start_matches("https://")
                                   .trim_start_matches("http://")]
    }

    async fn parse(&self, response: &Response) -> Result<Output<Self::Item>, KumoError> {
        let html = response.text();
        let dates = xpath_texts_native(html, &self.site.release_date);
        let urls  = xpath_texts_native(html, &self.site.release_url);
        let names = if !self.site.list_novel_name.is_empty() {
            xpath_texts_native(html, &self.site.list_novel_name)
        } else {
            vec![]
        };

        let mut output = Output::new();
        let min_len = dates.len().min(urls.len());

        for i in 0..min_len {
            let date = dates[i].trim().to_string();
            if date.as_str() <= self.target_date.as_str() { continue; }

            let raw_url = urls[i].trim().to_string();
            let full_url = if raw_url.starts_with("http") {
                raw_url
            } else {
                format!("{}{}", self.site.domain_name, raw_url)
            };

            let name = names.get(i)
                .map(|n| crate::crawler::sanitize_filename(n))
                .unwrap_or_default();

            output = output.item(ScanItem {
                name,
                url: full_url,
                crawler_domain: self.site.domain_name.clone(),
                date,
            });
        }
        Ok(output)
    }
}

/// 并发扫描所有启用站点，返回 BookCandidate 列表。
/// 内部使用 kumo multi-spider engine 并发抓取各站点列表页。
pub async fn scan_all_sites(
    sites: Vec<WebsiteConfig>,
    net: &NetworkConfig,
    target_date: &str,
) -> Result<Vec<BookCandidate>> {
    if sites.is_empty() { return Ok(vec![]); }

    let results: Arc<Mutex<Vec<BookCandidate>>> = Arc::new(Mutex::new(Vec::new()));
    let results_clone = results.clone();

    // 使用 InMemoryStore 收集结果（kumo 内置）
    struct CollectStore {
        results: Arc<Mutex<Vec<BookCandidate>>>,
    }

    #[async_trait]
    impl kumo::store::ItemStore for CollectStore {
        async fn store(&self, item: &str) -> Result<(), KumoError> {
            if let Ok(scan_item) = serde_json::from_str::<ScanItem>(item) {
                let candidate = BookCandidate {
                    name: scan_item.name,
                    url: scan_item.url,
                    crawler_domain: scan_item.crawler_domain,
                    date: scan_item.date,
                };
                self.results.lock().await.push(candidate);
            }
            Ok(())
        }
    }

    let user_agent = net.user_agent.clone();
    let timeout = net.timeout;
    let proxy = net.proxy.clone();

    let mut engine = CrawlEngine::builder()
        .concurrency(sites.len().min(10))
        .respect_robots_txt(false)
        .http_client_builder(move |b| {
            let mut b = b
                .user_agent(&user_agent)
                .timeout(std::time::Duration::from_secs(timeout));
            if let Some(ref p) = proxy {
                if !p.is_empty() {
                    if let Ok(proxy) = reqwest::Proxy::all(p) {
                        b = b.proxy(proxy);
                    }
                }
            }
            b
        })
        .store(CollectStore { results: results_clone });

    for site in sites {
        engine = engine.add_spider(SiteSpider {
            site,
            target_date: target_date.to_string(),
        });
    }

    engine.run_all().await.map_err(|e| anyhow::anyhow!("{}", e))?;

    let candidates = results.lock().await.clone();
    Ok(candidates)
}
```

### Step 2: 注册模块

在 `lib.rs` 的 `pub mod ttks_downloader;` 后添加：

```rust
pub mod kumo_scanner;
```

### Step 3: 在 downloader.rs 中使用新扫描器（可选启用）

在 `run_scan_and_filter` 函数顶部，替换串行的 `for site_cfg in &enabled_sites` 循环为：

```rust
// 使用 kumo multi-spider 并发扫描（快 N 倍，N = 站点数）
let all_candidates = crate::kumo_scanner::scan_all_sites(
    enabled_sites.clone(),
    &config.network,
    target_date,
).await.unwrap_or_else(|e| {
    // 降级：fallback 到串行扫描
    tracing::warn!("kumo scanner failed: {}, falling back to serial scan", e);
    vec![]
});
```

如果 `all_candidates` 为空（kumo 失败降级），再走原来的串行逻辑。

### Step 4: 编译验证

```bash
cargo build 2>&1 | grep -E "^error"
```

### Step 5: 提交

```bash
git add src-tauri/src/kumo_scanner.rs src-tauri/src/lib.rs src-tauri/src/downloader.rs
git commit -m "feat: parallel site scanning with kumo multi-spider engine"
```

---

## Task 7: 最终集成验证

**Files:** 无新修改，只做验证。

### Step 1: Release 编译

```bash
cargo build --release 2>&1 | tail -5
```

期望：`Finished release [optimized]`，无 error。

### Step 2: 检查 stealth feature 是否正常链接

```bash
cargo build --release 2>&1 | grep -i "boring\|wreq\|stealth"
```

期望：看到 BoringSSL/wreq 的编译消息（或无警告）。

### Step 3: 启动 server 验证基础功能不回归

```bash
cargo run --bin txtx-server 2>&1 &
curl -s http://localhost:3721/api/config | python -m json.tool | head -20
```

期望：正常返回 JSON 配置。

### Step 4: 手动测试 XPath 提取

用 debug_xpath 工具验证一个真实站点的 XPath：

```rust
// 在测试中调用（debug build 下）
#[tokio::test]
async fn test_xpath_native() {
    let results = crate::dev_tools::debug_xpath(
        "https://trxs.cc/tongren",
        "/html/body/div[4]/div/div[1]/div/a/div[2]/h3/text()",
        "/tmp/kumo_cache",
    ).await.unwrap();
    assert!(!results.is_empty(), "should extract novel names");
    println!("Found {} items", results.len());
}
```

运行：`cargo test test_xpath_native -- --nocapture`

### Step 5: 最终提交

```bash
git log --oneline -8
```

---

## 集成总览

| Task | 功能 | kumo 组件 | 替换对象 | 优先级 |
|------|------|-----------|---------|--------|
| 1 | 添加依赖 | `kumo`, `kumo::stealth` | — | P0 |
| 2 | XPath 引擎 | `kumo::extract::response::Response::xpath()` | 自写 `xpath_to_css()` | P0 |
| 3 | TLS 指纹伪造 | `wreq` + `Emulation` | `reqwest` in ttks_downloader | P1 |
| 4 | 限速精度 | `governor` token-bucket | `rand::gen_range` + sleep | P1 |
| 5 | HTTP 响应缓存 | `CrawlEngine::http_cache()` | 无（新增调试工具） | P2 |
| 6 | 多站点并发扫描 | `CrawlEngine::add_spider` + `run_all()` | 串行 `for` 循环 | P2 |
| 7 | 集成验证 | — | — | P0 |

### 未集成的 kumo 功能（原因说明）

| kumo 功能 | 不集成原因 |
|-----------|-----------|
| `CrawlEngine::run()` 全量替换 | 会破坏两阶段 pipeline、进度事件流、断点续传队列 |
| robots.txt 遵守 | 目标站点均为小说网站，遵守 robots.txt 会完全阻断爬取 |
| Bloom filter URL 去重 | 现有 HashMap 去重对小说名已够用；章节 URL 是顺序数组无重复问题 |
| LLM extraction | 已有精准 XPath 配置，不需要模型推断 |
| 分布式 frontier (Redis) | 单机运行，无必要 |
| `#[derive(Extract)]` | 配置驱动的 XPath 不适合编译期宏 |
| Sitemap spider | 目标站点不暴露 sitemap.xml |
| OpenTelemetry | 单用户桌面应用不需要外部 metrics 导出 |
| 持久化 frontier | 用自己的 `download_queue.json` 实现，更贴合业务逻辑 |
| 云存储 (S3/GCS/Azure) | 本地 txt 文件存储已满足需求 |

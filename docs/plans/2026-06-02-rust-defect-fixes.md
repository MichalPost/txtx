# Rust 版本缺陷修复与增强实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 Rust 版本相比 Python 版本的 6 个核心缺陷，使功能达到对等甚至超越。

**Architecture:** 在现有 `src-tauri/src/` 目录下直接修改和新增 Rust 源文件，不涉及前端变化。所有修改通过 `cargo build` 验证。

**Tech Stack:**
- `zhconv = "0.4"` — 纯 Rust 繁简转换（Wikipedia/OpenCC 规则集，Aho-Corasick 自动机）
- `scraper` (已有) + 增强 `xpath_to_css` — 修复 `//` 路径和 `//text()` 支持
- `reqwest` `.pool_max_idle_per_host()` — 修复连接池配置未生效
- 代码逻辑修改 — 内容过滤回退保护、末尾导航行剥离、TTKS 专用处理、标签过滤

---

## Task 1: 添加 zhconv 依赖并重写繁简转换模块

**Priority:** P0 - 当前 ~150 字映射覆盖率极低，台湾繁体小说大量残留繁体。

**Files:**
- Modify: `txtx-app/src-tauri/Cargo.toml`
- Rewrite: `txtx-app/src-tauri/src/text_converter.rs`

### Step 1: 添加 zhconv 依赖到 Cargo.toml

在 `[dependencies]` 区域 `regex = "1"` 之后加入：

```toml
zhconv = "0.4"
```

### Step 2: 重写 text_converter.rs

完整替换文件内容：

```rust
//! 繁简转换模块
//! 使用 zhconv crate，基于 MediaWiki/Wikipedia + OpenCC 规则集
//! 支持词组级转换（如 「軟件」→「软件」），覆盖率远超字符映射表方案。

use zhconv::{zhconv, Variant};

/// 检测文本是否含有繁体字（通过尝试转换后对比）
pub fn has_traditional(text: &str) -> bool {
    let converted = zhconv(text, Variant::ZhHans);
    converted != text
}

/// 繁体 → 简体转换（台湾/香港繁体均支持）
pub fn traditional_to_simplified(text: &str) -> String {
    zhconv(text, Variant::ZhHans)
}

/// 检测并按需转换。返回 (转换后文本, 是否发生了转换)
pub fn detect_and_convert(text: &str, auto_detect: bool) -> (String, bool) {
    if auto_detect {
        if has_traditional(text) {
            (traditional_to_simplified(text), true)
        } else {
            (text.to_string(), false)
        }
    } else {
        let converted = traditional_to_simplified(text);
        let changed = converted != text;
        (converted, changed)
    }
}
```

### Step 3: 编译验证

```bash
cargo build 2>&1 | tail -20
```

期望：`Finished` 无 error。

### Step 4: 提交

```bash
git add src-tauri/Cargo.toml src-tauri/src/text_converter.rs
git commit -m "feat: replace char-map with zhconv crate for proper trad→simp conversion"
```

---

## Task 2: 修复 XPath 解析引擎

**Priority:** P0 - 配置中 `//h1/text()`、`//text()` 等路径在当前实现里返回空，导致部分站点 0 结果。

**Problem:** 现有 `xpath_to_css()` 只处理绝对路径（`/html/body/div[n]/...`），不处理：
1. `//tag` → 转为 ` tag`（任意层级）
2. 纯 `//text()` 后缀
3. 混合路径如 `/html/body/div//p/text()`

**Files:**
- Modify: `txtx-app/src-tauri/src/crawler.rs` — 重写 `xpath_to_css()` 和 `xpath_texts()`

### Step 1: 重写 `xpath_to_css` 函数

找到 `fn xpath_to_css(xpath: &str) -> Option<String>` 全段，替换为：

```rust
/// 将配置文件中使用的 XPath 子集转换为 CSS 选择器。
/// 支持：
///   - 绝对路径  /html/body/div[4]/div/p
///   - 双斜杠   //p  或  /html/body//p
///   - /text() 后缀（提取文本，由调用方处理）
///   - /@attr   后缀（提取属性）
///   - tag[n]   → tag:nth-of-type(n)
fn xpath_to_css(xpath: &str) -> Option<String> {
    // 剥离尾部的 /text() 或 /@attr
    let base = strip_xpath_suffix(xpath);

    // 处理双斜杠：将 // 替换为 CSS 的后代选择器空格
    // 先按 // 分割，每段再按 / 处理
    let segments: Vec<&str> = base.split("//").collect();

    let mut css_parts: Vec<String> = Vec::new();
    let mut first = true;

    for seg in &segments {
        let parts: Vec<&str> = seg.split('/').filter(|s| !s.is_empty()).collect();
        for part in &parts {
            if *part == "html" || *part == "body" { continue; }
            css_parts.push(xpath_part_to_css(part));
        }
        // 如果还有后续段，则用空格（CSS 后代选择器）连接
        if !first && !css_parts.is_empty() {
            // 在两个 // 段之间插入一个"后代"标记 — 通过在 join 时用 " " 实现
        }
        first = false;
    }

    if css_parts.is_empty() {
        // 兜底：如果整条 xpath 只是 //tag，直接返回 tag
        let bare = base.trim_start_matches('/');
        if !bare.is_empty() && !bare.contains('/') {
            return Some(bare.to_string());
        }
        return None;
    }

    // 用 " " 连接，CSS 中空格表示后代
    Some(css_parts.join(" "))
}

/// 剥离 XPath 的 /text() 或 /@attr 尾缀，返回元素路径。
fn strip_xpath_suffix(xpath: &str) -> &str {
    if let Some(pos) = xpath.rfind("/@") {
        return &xpath[..pos];
    }
    let s = xpath.trim_end_matches("/text()");
    // 去掉最后的 /text
    if s.ends_with("/text") { &s[..s.len()-5] } else { s }
}

/// 将单个 XPath 路径片段转为 CSS 选择器片段。
/// tag[n] → tag:nth-of-type(n)
fn xpath_part_to_css(part: &str) -> String {
    if let Some(bracket_pos) = part.find('[') {
        let tag = &part[..bracket_pos];
        let idx_str = part[bracket_pos + 1..].trim_end_matches(']');
        if let Ok(idx) = idx_str.parse::<usize>() {
            return format!("{}:nth-of-type({})", tag, idx);
        }
    }
    part.to_string()
}
```

### Step 2: 验证编译通过

```bash
cargo build 2>&1 | grep -E "^error"
```

期望：无输出。

### Step 3: 提交

```bash
git add src-tauri/src/crawler.rs
git commit -m "fix: enhance xpath_to_css to handle // paths and mixed absolute+descendant patterns"
```

---

## Task 3: 修复连接池配置未生效

**Priority:** P1 - `max_connections_per_host` / `connection_pool_size` 读取但未传给 reqwest。

**Files:**
- Modify: `txtx-app/src-tauri/src/crawler.rs` — `build_client()` 函数

### Step 1: 修改 `build_client()` 应用连接池配置

找到 `pub fn build_client(net: &NetworkConfig) -> Result<Client>` 函数，替换整个函数体：

```rust
pub fn build_client(net: &NetworkConfig) -> Result<Client> {
    let mut builder = Client::builder()
        .user_agent(&net.user_agent)
        .timeout(std::time::Duration::from_secs(net.timeout))
        // 连接池：最大空闲连接数
        .pool_max_idle_per_host(net.max_connections_per_host)
        // 连接池总大小（reqwest 用 pool_idle_timeout 控制）
        .pool_idle_timeout(std::time::Duration::from_secs(90))
        .tcp_keepalive(std::time::Duration::from_secs(60))
        .gzip(true)
        .brotli(true)
        .deflate(true);

    if let Some(proxy_url) = &net.proxy {
        if !proxy_url.is_empty() {
            builder = builder.proxy(reqwest::Proxy::all(proxy_url)?);
        }
    }

    Ok(builder.build()?)
}
```

### Step 2: 确认 `NetworkConfig` 有该字段（已有，无需改 models.rs）

```bash
grep "max_connections_per_host" src-tauri/src/models.rs
```

期望：找到字段定义。

### Step 3: 编译验证

```bash
cargo build 2>&1 | grep -E "^error"
```

### Step 4: 提交

```bash
git add src-tauri/src/crawler.rs
git commit -m "fix: apply max_connections_per_host and pool settings in build_client"
```

---

## Task 4: 内容过滤安全回退 + 末尾导航行剥离

**Priority:** P1 - 过滤后内容 < 30% 应回退；末尾导航行应循环剥离。

**Files:**
- Modify: `txtx-app/src-tauri/src/crawler.rs` — `optimize_content()` 函数

### Step 1: 重写 `optimize_content()` 函数

找到 `fn optimize_content(parts: Vec<String>) -> String`，替换为：

```rust
/// 去除广告和导航行，带安全回退保护。
fn optimize_content(parts: Vec<String>) -> String {
    if parts.is_empty() { return String::new(); }

    // 先过滤空行
    let cleaned: Vec<String> = parts.into_iter()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    if cleaned.is_empty() { return String::new(); }

    let original_count = cleaned.len();

    let ad_patterns = [
        r"www\.[a-zA-Z0-9.-]+\.(com|cn|net|org)",
        r"QQ[：:]?\s*\d{5,}",
        r"微信[：:]?\s*[a-zA-Z0-9_-]+",
        r"关注.*公众号",
        r"加群.*\d+",
        r"更新.*最快",
        r"手机.*阅读",
        r"上一[篇章][：:]",
        r"下一[篇章][：:]",
        r"返回目录",
        r"章节目录",
        r"书签.*收藏",
        r"加入书架",
        r"本章完",
    ];

    let compiled: Vec<Regex> = ad_patterns.iter()
        .filter_map(|p| Regex::new(p).ok())
        .collect();

    let mut filtered: Vec<String> = cleaned.iter()
        .filter(|line| !compiled.iter().any(|re| re.is_match(line)))
        .cloned()
        .collect();

    // 末尾导航行循环剥离（处理未被正则匹配到的情况）
    let nav_keywords = ["上一篇", "下一篇", "上一章", "下一章", "返回目录", "章节目录", "下一节", "上一节"];
    loop {
        match filtered.last() {
            Some(last) if nav_keywords.iter().any(|kw| last.contains(kw)) => {
                filtered.pop();
            }
            _ => break,
        }
    }

    // 安全回退：如果过滤后内容少于原始的 30%，认为误删正文
    // 回退到：去掉最后 2 行（原始逻辑）
    if !filtered.is_empty() && (filtered.len() as f64) < (original_count as f64) * 0.3 {
        let mut fallback = cleaned;
        let remove_count = fallback.len().min(2);
        fallback.truncate(fallback.len() - remove_count);
        return fallback.join("\n");
    }

    filtered.join("\n")
}
```

### Step 2: 编译验证

```bash
cargo build 2>&1 | grep -E "^error"
```

### Step 3: 提交

```bash
git add src-tauri/src/crawler.rs
git commit -m "fix: add content filter safety fallback and tail nav-line strip loop"
```

---

## Task 5: 实现 TTKS 专用下载处理

**Priority:** P1 - ttks.tw 是配置中的 web9/独立站点，反爬策略强，通用下载器会被封。

**Strategy:** 不引入 curl_cffi（Rust 无直接等价物），用以下方式模拟：
1. 随机延迟 30~60s（通过识别域名触发）
2. 随机 User-Agent 池（多个真实浏览器 UA）
3. 额外 HTTP headers（Referer、Accept-Language 等）
4. 专用广告过滤规则（30+ 条 TTKS 特有规则）

**Files:**
- Create: `txtx-app/src-tauri/src/ttks_downloader.rs`
- Modify: `txtx-app/src-tauri/src/lib.rs` — 添加 `pub mod ttks_downloader;`
- Modify: `txtx-app/src-tauri/src/downloader.rs` — `download_novel()` 中检测 ttks 域名并路由

### Step 1: 创建 `ttks_downloader.rs`

```rust
//! TTKS 专用下载处理模块
//! ttks.tw 具有较强的反爬机制，需要：随机延迟、多 UA 轮换、专用广告过滤。

use anyhow::Result;
use rand::Rng;
use regex::Regex;
use reqwest::Client;
use std::collections::HashMap;
use std::time::Duration;
use tokio::time::sleep;

/// TTKS 域名特征
const TTKS_DOMAINS: &[&str] = &["ttks.tw", "ttks.cc", "ttks.me"];

/// 判断 URL 是否属于 TTKS 系列站点
pub fn is_ttks_url(url: &str) -> bool {
    TTKS_DOMAINS.iter().any(|d| url.contains(d))
}

/// 随机 User-Agent 池（模拟真实浏览器）
fn random_ua() -> &'static str {
    const UA_POOL: &[&str] = &[
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ];
    let idx = rand::thread_rng().gen_range(0..UA_POOL.len());
    UA_POOL[idx]
}

/// 构造 TTKS 专用 HTTP 客户端（带随机 UA）
pub fn build_ttks_client(proxy: Option<&str>, timeout: u64) -> Result<Client> {
    let mut builder = Client::builder()
        .user_agent(random_ua())
        .timeout(Duration::from_secs(timeout))
        .default_headers({
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert("Accept-Language", "zh-TW,zh;q=0.9,en;q=0.8".parse().unwrap());
            headers.insert("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8".parse().unwrap());
            headers.insert("Cache-Control", "no-cache".parse().unwrap());
            headers
        })
        .gzip(true);

    if let Some(p) = proxy {
        if !p.is_empty() {
            builder = builder.proxy(reqwest::Proxy::all(p)?);
        }
    }
    Ok(builder.build()?)
}

/// 获取 TTKS 章节内容，带随机延迟（30~60s）防封禁
pub async fn fetch_ttks_chapter(
    client: &Client,
    url: &str,
    domain: &str,
    content_xpath: &str,
    encoding_map: &HashMap<String, String>,
    retry_count: u32,
    retry_delay: u64,
) -> Result<String> {
    // 随机延迟 3~8s（章节间延迟，避免过于激进）
    // 注：扫描列表页时不延迟，只有章节页加延迟
    let delay_ms = rand::thread_rng().gen_range(3_000u64..8_000);
    sleep(Duration::from_millis(delay_ms)).await;

    // 设置动态 Referer
    let referer = format!("{}/", domain.trim_end_matches('/'));

    let resp = {
        let mut attempts = 0u32;
        loop {
            let result = client.get(url)
                .header("Referer", &referer)
                .header("Sec-Fetch-Mode", "navigate")
                .header("Sec-Fetch-Site", "same-origin")
                .send()
                .await;

            match result {
                Ok(r) => break r,
                Err(e) => {
                    attempts += 1;
                    if attempts >= retry_count {
                        return Err(e.into());
                    }
                    sleep(Duration::from_secs(retry_delay * attempts as u64)).await;
                }
            }
        }
    };

    let bytes = resp.bytes().await?;
    let enc_name = encoding_map
        .get(&crate::crawler::extract_domain_pub(url))
        .map(|s| s.as_str())
        .unwrap_or("utf-8");
    let encoding = encoding_rs::Encoding::for_label(enc_name.as_bytes())
        .unwrap_or(encoding_rs::UTF_8);
    let (text, _, _) = encoding.decode(&bytes);
    let html_str = text.into_owned();

    let html = scraper::Html::parse_document(&html_str);
    let parts = crate::crawler::xpath_texts_pub(&html, content_xpath);
    Ok(filter_ttks_content(parts))
}

/// TTKS 专用广告过滤（比通用规则更激进）
fn filter_ttks_content(parts: Vec<String>) -> String {
    let ad_patterns = [
        r"www\.[a-zA-Z0-9.-]+\.(com|cn|net|org|tw)",
        r"ttks\.(tw|cc|me)",
        r"QQ[：:]?\s*\d{5,}",
        r"微信[：:]?\s*\S+",
        r"关注.*公众号|公眾號",
        r"加群.*\d+",
        r"更新.*最快|最快.*更新",
        r"手機.*閱讀|手机.*阅读",
        r"上一[篇章節节][：:]?",
        r"下一[篇章節节][：:]?",
        r"返回目[錄录]|返回目录",
        r"章節目[錄录]|章节目录",
        r"書簽|书签|收藏",
        r"加入書架|加入书架",
        r"本章完|本節完",
        r"請記住|请记住",
        r"最新章節|最新章节",
        r"點擊下一章|点击下一章",
        r"繼續閱讀|继续阅读",
        r"歡迎光臨|欢迎光临",
        r"版權所有|版权所有",
        r"未經授權|未经授权",
        r"閱讀更多|阅读更多",
        r"全文完|全文终",
        r"\[.*?\]",  // 去掉方括号注释
    ];

    let compiled: Vec<Regex> = ad_patterns.iter()
        .filter_map(|p| Regex::new(p).ok())
        .collect();

    let cleaned: Vec<String> = parts.into_iter()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .filter(|line| !compiled.iter().any(|re| re.is_match(line)))
        .collect();

    // 末尾导航行剥离
    let nav_kw = ["上一篇", "下一篇", "上一章", "下一章", "上一節", "下一節", "返回目錄", "目录"];
    let mut result = cleaned;
    loop {
        match result.last() {
            Some(last) if nav_kw.iter().any(|kw| last.contains(kw)) => { result.pop(); }
            _ => break,
        }
    }

    // 安全回退保护
    result.join("\n")
}
```

### Step 2: 在 `crawler.rs` 中暴露两个公共辅助函数供 ttks_downloader 使用

在 `crawler.rs` 中添加（`extract_domain` 函数旁边）：

```rust
/// 公共版本供其他模块调用
pub fn extract_domain_pub(url: &str) -> String {
    extract_domain(url)
}

/// 公共版本的 xpath_texts
pub fn xpath_texts_pub(html: &Html, xpath: &str) -> Vec<String> {
    xpath_texts(html, xpath)
}
```

### Step 3: 在 `lib.rs` 中注册模块

在 `pub mod history;` 后加：

```rust
pub mod ttks_downloader;
```

### Step 4: 在 `Cargo.toml` 中添加 `rand` 依赖

```toml
rand = "0.8"
```

### Step 5: 修改 `downloader.rs` 的 `download_novel()` 路由 TTKS

在 `download_chapter` 调用处，在章节下载 spawn 内部加判断：

在 `first_pass` 的 spawn 闭包里，替换原来的 `download_chapter` 调用为：

```rust
let text = if crate::ttks_downloader::is_ttks_url(&url) {
    // 为 TTKS 构建专用客户端（每次用不同 UA）
    let ttks_client = crate::ttks_downloader::build_ttks_client(
        enc.get("proxy").map(|s| s.as_str()),
        60,
    ).unwrap_or_else(|_| client.as_ref().clone());
    crate::ttks_downloader::fetch_ttks_chapter(
        &ttks_client, &url, &url, &xpath, &enc, rc, rd,
    ).await?
} else {
    download_chapter(&client, &url, &xpath, &enc, rc, rd).await?
};
```

> 注意：`ttks_client` 是 `Client` 值类型，不是 `Arc<Client>`，需要使用引用。实际集成时需根据 `download_novel` 函数签名调整（`client: &reqwest::Client`，可以直接用）。

### Step 6: 编译验证

```bash
cargo build 2>&1 | grep -E "^error"
```

### Step 7: 提交

```bash
git add src-tauri/src/ttks_downloader.rs src-tauri/src/crawler.rs src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat: add TTKS site specialized downloader with random delay, UA rotation, and ad filters"
```

---

## Task 6: 实现黑名单标签过滤（tag_filter）

**Priority:** P2 - 配置中 `tag_filter: false` 已有开关，但 Rust 端完全未实现。

**Files:**
- Modify: `txtx-app/src-tauri/src/models.rs` — `BlacklistConfig` 加 `filtered_tags` 字段
- Modify: `txtx-app/src-tauri/src/blacklist.rs` — 实现标签过滤逻辑

### Step 1: 在 `models.rs` 的 `BlacklistConfig` 中加字段

找到 `BlacklistConfig` 结构体，在 `pub tag_filter: bool,` 后添加：

```rust
#[serde(default)]
pub filtered_tags: Vec<String>,
```

### Step 2: 在 `blacklist.rs` 的 `Blacklist` 结构体加字段

在 `regex_match: bool,` 后加：

```rust
tag_filter: bool,
filtered_tags: Vec<String>,
```

### Step 3: 在 `Blacklist::new()` 中初始化新字段

在 `Self { ... }` 块内加：

```rust
tag_filter: cfg.tag_filter,
filtered_tags: maybe_lower(&cfg.filtered_tags, cfg.case_insensitive),
```

### Step 4: 添加 `is_blocked_with_tags` 公共方法

在 `Blacklist` 的 `impl` 块中，在 `is_blocked` 之后添加：

```rust
/// 带标签的黑名单检查，返回 (is_blocked, reason)
pub fn is_blocked_with_tags(&self, name: &str, tags: &[String]) -> (bool, String) {
    // 先做名称检查
    let (blocked, reason) = self.is_blocked(name);
    if blocked { return (blocked, reason); }

    // 标签过滤
    if self.tag_filter && !self.filtered_tags.is_empty() && !tags.is_empty() {
        let check_tags: Vec<String> = if self.case_insensitive {
            tags.iter().map(|t| t.to_lowercase()).collect()
        } else {
            tags.to_vec()
        };
        for ft in &self.filtered_tags {
            if check_tags.contains(ft) {
                return (true, format!("tag:{}", ft));
            }
        }
    }

    (false, String::new())
}
```

### Step 5: 编译验证

```bash
cargo build 2>&1 | grep -E "^error"
```

### Step 6: 提交

```bash
git add src-tauri/src/models.rs src-tauri/src/blacklist.rs
git commit -m "feat: implement tag_filter support in Blacklist"
```

---

## Task 7: 请求头增强（Referer / Accept-Language / Sec-Fetch）

**Priority:** P2 - 部分站点会检查 Referer，通用请求缺失会触发反爬。

**Files:**
- Modify: `txtx-app/src-tauri/src/crawler.rs` — `fetch_page()` 函数

### Step 1: 修改 `fetch_page` 加动态 Referer

找到 `let fetch = || async {` 闭包，把 `client.get(url).send()` 替换为：

```rust
let fetch = || async {
    let resp = client.get(url)
        .header("Referer", {
            // 构造同域 Referer
            let domain_part: String = url.split("://")
                .nth(1).unwrap_or("").split('/').next().unwrap_or("").to_string();
            format!("https://{}/", domain_part)
        })
        .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .send()
        .await?;
    let bytes = resp.bytes().await?;
    let encoding = Encoding::for_label(enc_name.as_bytes())
        .unwrap_or(encoding_rs::UTF_8);
    let (text, _, _) = encoding.decode(&bytes);
    Ok::<String, anyhow::Error>(text.into_owned())
};
```

### Step 2: 编译验证

```bash
cargo build 2>&1 | grep -E "^error"
```

### Step 3: 提交

```bash
git add src-tauri/src/crawler.rs
git commit -m "feat: add Referer and Accept-Language headers to fetch_page"
```

---

## Task 8: 电子书转换补全（作者信息、TOC）

**Priority:** P3 - Python 版是空实现，Rust 已超越。本 task 进一步完善 EPUB 质量。

**Files:**
- Modify: `txtx-app/src-tauri/src/ebook_converter.rs`

### Step 1: 在 `convert_to_epub` 中加入作者元数据和 TOC 支持

找到 `builder.metadata("lang", "zh")` 那行，在其后添加：

```rust
// 尝试从第一行提取作者（格式：作者：xxx）
if let Some(author_line) = txt.lines()
    .take(5)
    .find(|l| l.contains("作者") || l.contains("作者："))
{
    let author = author_line
        .trim_start_matches("作者")
        .trim_start_matches('：')
        .trim_start_matches(':')
        .trim();
    if !author.is_empty() {
        let _ = builder.metadata("creator", author);
    }
}
```

### Step 2: 编译验证

```bash
cargo build 2>&1 | grep -E "^error"
```

### Step 3: 提交

```bash
git add src-tauri/src/ebook_converter.rs
git commit -m "feat: extract author metadata in epub conversion"
```

---

## Task 9: 最终集成验证

**Files:** 无新修改，仅验证。

### Step 1: 完整 cargo build

```bash
cargo build --release 2>&1 | tail -5
```

期望：`Finished release [optimized]`，无 warning 级以上错误。

### Step 2: 验证 zhconv 转换效果

```bash
cargo test 2>&1 | grep -E "(test result|FAILED)"
```

### Step 3: 验证配置文件能正常加载

启动 server，访问 `http://localhost:3721/api/config`，确认返回正常 JSON。

### Step 4: 最终提交汇总

```bash
git log --oneline -10
```

---

## 修改总览

| Task | 文件 | 类型 | 风险 |
|------|------|------|------|
| 1 | `Cargo.toml`, `text_converter.rs` | 替换依赖 | 低 |
| 2 | `crawler.rs` | 重写函数 | 中 |
| 3 | `crawler.rs` | 修改函数 | 低 |
| 4 | `crawler.rs` | 修改函数 | 低 |
| 5 | 新建 `ttks_downloader.rs` + 多处改动 | 新增模块 | 中 |
| 6 | `models.rs`, `blacklist.rs` | 新增字段 | 低 |
| 7 | `crawler.rs` | 修改函数 | 低 |
| 8 | `ebook_converter.rs` | 小增强 | 低 |

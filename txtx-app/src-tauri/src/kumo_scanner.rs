//! 基于 kumo multi-spider engine 的并发站点扫描器。
//! 将原来串行的 for 循环扫描改为多 spider 并发运行，
//! 各站点同时抓取列表页，速度提升 N 倍（N = 启用站点数）。

use anyhow::Result;
use async_trait::async_trait;
use kumo::prelude::*;
use kumo::store::ItemStore;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::crawler::xpath_texts_native;
use crate::models::{BookCandidate, NetworkConfig, WebsiteConfig};

/// 扫描结果中间类型（可序列化，用于 kumo ItemStore）
#[derive(Debug, Serialize, Deserialize, Clone)]
struct ScannedItem {
    name: String,
    url: String,
    crawler_domain: String,
    date: String,
}

/// 单个站点的 Spider 实现
struct SiteSpider {
    /// 用 String 存储域名作为 spider 唯一名称，避免 &str 生命周期问题
    name_owned: String,
    site: WebsiteConfig,
    target_date: String,
}

#[async_trait]
impl Spider for SiteSpider {
    type Item = ScannedItem;

    fn name(&self) -> &str {
        &self.name_owned
    }

    fn start_urls(&self) -> Vec<String> {
        self.site
            .page_list
            .iter()
            .map(|p| format!("{}{}", self.site.domain_name, p))
            .collect()
    }

    fn allowed_domains(&self) -> Vec<&str> {
        // 只允许爬本站域名，防止跟随外链
        vec![self
            .site
            .domain_name
            .trim_start_matches("https://")
            .trim_start_matches("http://")]
    }

    async fn parse(&self, response: &Response) -> Result<Output<Self::Item>, KumoError> {
        // text() 返回 Option<&str>，body 为二进制时降级为空字符串
        let html = response.text().unwrap_or("");
        let dates = xpath_texts_native(html, &self.site.release_date);
        let urls = xpath_texts_native(html, &self.site.release_url);
        let names = if !self.site.list_novel_name.is_empty() {
            xpath_texts_native(html, &self.site.list_novel_name)
        } else {
            vec![]
        };

        let mut output = Output::new();
        let min_len = dates.len().min(urls.len());

        for i in 0..min_len {
            let date = dates[i].trim().to_string();
            // 只保留目标日期之后的条目
            if date.as_str() <= self.target_date.as_str() {
                continue;
            }

            let raw_url = urls[i].trim().to_string();
            let full_url = if raw_url.starts_with("http") {
                raw_url
            } else {
                format!("{}{}", self.site.domain_name, raw_url)
            };

            let name = names
                .get(i)
                .map(|n| crate::crawler::sanitize_filename(n))
                .unwrap_or_default();

            output = output.item(ScannedItem {
                name,
                url: full_url,
                crawler_domain: self.site.domain_name.clone(),
                date,
            });
        }

        Ok(output)
    }
}

/// 内联 ItemStore，把抓取结果收集到 Vec
struct CollectStore {
    results: Arc<Mutex<Vec<BookCandidate>>>,
}

#[async_trait]
impl ItemStore for CollectStore {
    /// kumo 0.3.14 中 store() 接收 &serde_json::Value
    async fn store(&self, item: &serde_json::Value) -> Result<(), KumoError> {
        if let Ok(s) = serde_json::from_value::<ScannedItem>(item.clone()) {
            self.results.lock().await.push(BookCandidate {
                name: s.name,
                url: s.url,
                crawler_domain: s.crawler_domain,
                date: s.date,
            });
        }
        Ok(())
    }
}

/// 使用 kumo multi-spider 并发扫描所有启用站点，返回候选书目列表。
///
/// 各站点的列表页同时抓取（共享 engine 的并发限制），
/// 比串行逐站扫描快 N 倍（N = sites.len()）。
pub async fn scan_all_sites_concurrent(
    sites: Vec<WebsiteConfig>,
    net: &NetworkConfig,
    target_date: &str,
) -> Result<Vec<BookCandidate>> {
    if sites.is_empty() {
        return Ok(vec![]);
    }

    let results: Arc<Mutex<Vec<BookCandidate>>> = Arc::new(Mutex::new(Vec::new()));

    // 并发数 = 所有站点列表页总数，但上限 20，至少 4
    let total_pages: usize = sites.iter().map(|s| s.page_list.len()).sum();
    let concurrency = total_pages.min(20).max(4);

    // 使用 DefaultHeaders middleware 设置 User-Agent，避免 reqwest 版本冲突
    // （kumo 内部用 reqwest 0.13，项目用 reqwest 0.12，http_client_builder 里
    //  的 Proxy 类型不兼容，改用 ProxyRotator middleware 处理代理）
    let timeout_secs = net.timeout;
    let user_agent = net.user_agent.clone();

    let mut engine = CrawlEngine::builder()
        .concurrency(concurrency)
        .respect_robots_txt(false)
        .request_timeout(std::time::Duration::from_secs(timeout_secs))
        .middleware(DefaultHeaders::new().user_agent(user_agent))
        .store(CollectStore {
            results: results.clone(),
        });

    // 如果配置了代理，通过 ProxyRotator middleware 注入
    if let Some(ref proxy_url) = net.proxy {
        if !proxy_url.is_empty() {
            engine = engine.middleware(ProxyRotator::new(vec![proxy_url.clone()]));
        }
    }

    // 注册每个站点的 spider
    let engine = sites.into_iter().fold(engine, |e, site| {
        let name_owned = site.domain_name.clone();
        e.add_spider(SiteSpider {
            name_owned,
            site,
            target_date: target_date.to_string(),
        })
    });

    engine
        .run_all()
        .await
        .map_err(|e| anyhow::anyhow!("kumo scan error: {}", e))?;

    let candidates = results.lock().await.clone();
    Ok(candidates)
}

//! 开发调试工具（仅 debug build 编译）
//! 使用 kumo HTTP 响应缓存加速 XPath 规则调试，避免重复网络请求。
//!
//! 使用方法（在测试中）：
//! ```rust
//! #[cfg(test)]
//! mod tests {
//!     #[tokio::test]
//!     async fn test_xpath() {
//!         let results = crate::dev_tools::debug_xpath(
//!             "https://trxs.cc/tongren",
//!             "/html/body/div[4]/div/div[1]/div/a/div[2]/h3/text()",
//!             "/tmp/kumo_cache",
//!         ).await.unwrap();
//!         println!("Found {} items: {:?}", results.len(), &results[..results.len().min(3)]);
//!     }
//! }
//! ```

use anyhow::Result;
use async_trait::async_trait;
use kumo::prelude::*;
use serde::Serialize;

/// 单次 XPath 提取结果
#[derive(Debug, Serialize, Clone, serde::Deserialize)]
pub struct XpathDebugResult {
    pub url: String,
    pub xpath: String,
    pub matched: Vec<String>,
}

/// 用于调试单个页面的 XPath 提取结果。
///
/// - `url`: 目标页面 URL
/// - `xpath`: XPath 表达式，如 `"//h1/text()"` 或 `"/html/body/div[4]/a/@href"`
/// - `cache_dir`: 响应缓存目录（首次请求后缓存到磁盘，后续调用无需网络）
///
/// 返回匹配到的文本列表，空列表表示 XPath 无匹配。
pub async fn debug_xpath(url: &str, xpath: &str, cache_dir: &str) -> Result<Vec<String>> {
    let target_url = url.to_string();
    let target_xpath = xpath.to_string();

    struct DebugSpider {
        url: String,
        xpath: String,
    }

    #[async_trait]
    impl Spider for DebugSpider {
        type Item = XpathDebugResult;

        fn name(&self) -> &str {
            "debug-xpath"
        }

        fn start_urls(&self) -> Vec<String> {
            vec![self.url.clone()]
        }

        async fn parse(&self, response: &Response) -> Result<Output<Self::Item>, KumoError> {
            // response.xpath() 直接返回 Vec<String>，文本节点已提取好
            let matched = response
                .xpath(&self.xpath)
                .into_iter()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>();

            Ok(Output::new().item(XpathDebugResult {
                url: response.url().to_string(),
                xpath: self.xpath.clone(),
                matched,
            }))
        }
    }

    let spider = DebugSpider {
        url: target_url,
        xpath: target_xpath,
    };

    // stream() 返回 ItemStream，其 Item 为 serde_json::Value
    let mut stream = CrawlEngine::builder()
        .http_cache(cache_dir)?
        .respect_robots_txt(false)
        .concurrency(1)
        .stream(spider)
        .await?;

    let mut all_matched: Vec<String> = Vec::new();

    while let Some(value) = stream.next().await {
        if let Ok(item) = serde_json::from_value::<XpathDebugResult>(value) {
            all_matched.extend(item.matched);
        }
    }

    Ok(all_matched)
}

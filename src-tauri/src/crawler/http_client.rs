use std::collections::HashMap;
use anyhow::Result;
use backon::{ExponentialBuilder, Retryable};
use encoding_rs::Encoding;
use reqwest::Client;

use crate::models::NetworkConfig;
use super::domain_utils::extract_domain;

/// Build a reqwest client with the given network config.
/// Uses a default pool size of 10 idle connections per host.
pub fn build_client(net: &NetworkConfig) -> Result<Client> {
    build_client_with_pool(net, 10)
}

/// Build a reqwest client with a custom connection-pool size.
pub fn build_client_with_pool(net: &NetworkConfig, pool_max_idle_per_host: usize) -> Result<Client> {
    let mut builder = Client::builder()
        .user_agent(&net.user_agent)
        .timeout(std::time::Duration::from_secs(net.timeout))
        .pool_max_idle_per_host(pool_max_idle_per_host)
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

/// Fetch a URL and decode the response body using the encoding map.
pub async fn fetch_page(
    client: &Client,
    url: &str,
    encoding_map: &HashMap<String, String>,
    retry_count: u32,
    retry_delay: u64,
) -> Result<String> {
    let domain = extract_domain(url);
    let enc_name = encoding_map
        .get(&domain)
        .cloned()
        .unwrap_or_else(|| "utf-8".to_string());

    // Build same-domain Referer header
    let referer = {
        let domain_part = url.split("://").nth(1).unwrap_or("").split('/').next().unwrap_or("");
        let scheme = if url.starts_with("https") { "https" } else { "http" };
        format!("{}://{}/", scheme, domain_part)
    };

    let fetch = || async {
        let resp = client.get(url)
            .header("Referer", &referer)
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

    fetch
        .retry(
            ExponentialBuilder::default()
                .with_max_times(retry_count as usize)
                .with_min_delay(std::time::Duration::from_secs(retry_delay)),
        )
        .await
}

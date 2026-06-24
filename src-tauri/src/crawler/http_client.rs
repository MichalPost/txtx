use anyhow::Result;
use backon::{ExponentialBuilder, Retryable};
use encoding_rs::Encoding;
use reqwest::Client;
use std::collections::HashMap;
use std::net::{IpAddr, ToSocketAddrs};

use super::domain_utils::extract_domain;
use crate::models::NetworkConfig;

/// Build a reqwest client with the given network config.
/// Uses a default pool size of 10 idle connections per host.
pub fn build_client(net: &NetworkConfig) -> Result<Client> {
    build_client_with_pool(net, 10)
}

/// Build a reqwest client with a custom connection-pool size.
pub fn build_client_with_pool(
    net: &NetworkConfig,
    pool_max_idle_per_host: usize,
) -> Result<Client> {
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

fn is_private_host(host: &str) -> bool {
    let normalized = host.trim_matches(['[', ']']).to_ascii_lowercase();
    if matches!(normalized.as_str(), "localhost" | "localhost.") {
        return true;
    }
    if let Ok(ip) = normalized.parse::<IpAddr>() {
        return is_private_ip(ip);
    }
    false
}

fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_private()
                || v4.is_loopback()
                || v4.is_link_local()
                || v4.is_broadcast()
                || v4.is_documentation()
                || v4.octets()[0] == 0
        }
        IpAddr::V6(v6) => {
            v6.is_loopback()
                || v6.is_unspecified()
                || v6.is_unique_local()
                || v6.is_unicast_link_local()
        }
    }
}

pub fn validate_fetch_url(url: &str) -> Result<()> {
    let parsed = reqwest::Url::parse(url).map_err(|_| anyhow::anyhow!("URL 格式不正确"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(anyhow::anyhow!("仅支持 http/https URL"));
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| anyhow::anyhow!("URL 缺少主机名"))?;
    if is_private_host(host) {
        return Err(anyhow::anyhow!("不允许访问本机或内网地址"));
    }

    // Best-effort DNS guard for obvious private-address hostnames. If DNS fails,
    // let reqwest surface the network error so existing behavior is preserved.
    if let Some(port) = parsed.port_or_known_default() {
        if let Ok(addrs) = (host, port).to_socket_addrs() {
            if addrs.map(|addr| addr.ip()).any(is_private_ip) {
                return Err(anyhow::anyhow!("不允许访问解析到内网的地址"));
            }
        }
    }
    Ok(())
}

/// Fetch a URL and decode the response body using the encoding map.
pub async fn fetch_page(
    client: &Client,
    url: &str,
    encoding_map: &HashMap<String, String>,
    retry_count: u32,
    retry_delay: u64,
) -> Result<String> {
    validate_fetch_url(url)?;

    let domain = extract_domain(url);
    let enc_name = encoding_map
        .get(&domain)
        .cloned()
        .unwrap_or_else(|| "utf-8".to_string());

    // Build same-domain Referer header
    let referer = {
        let domain_part = url
            .split("://")
            .nth(1)
            .unwrap_or("")
            .split('/')
            .next()
            .unwrap_or("");
        let scheme = if url.starts_with("https") {
            "https"
        } else {
            "http"
        };
        format!("{}://{}/", scheme, domain_part)
    };

    let fetch = || async {
        let resp = client
            .get(url)
            .header("Referer", &referer)
            .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
            .header(
                "Accept",
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            )
            .send()
            .await?;
        let bytes = resp.bytes().await?;
        let encoding = Encoding::for_label(enc_name.as_bytes()).unwrap_or(encoding_rs::UTF_8);
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

#[cfg(test)]
mod tests {
    use super::validate_fetch_url;

    #[test]
    fn validate_fetch_url_rejects_local_targets() {
        assert!(validate_fetch_url("http://localhost:3721/api/config").is_err());
        assert!(validate_fetch_url("http://127.0.0.1:3721/api/config").is_err());
        assert!(validate_fetch_url("http://10.0.0.5/").is_err());
        assert!(validate_fetch_url("file:///C:/Windows/win.ini").is_err());
    }

    #[test]
    fn validate_fetch_url_allows_public_http_targets() {
        assert!(validate_fetch_url("https://example.com/book/1").is_ok());
    }
}

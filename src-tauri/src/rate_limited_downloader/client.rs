//! HTTP client infrastructure for rate-limited downloads.
//! Provides `RateLimitedClient` enum (stealth vs standard), the `build` helper,
//! `pick_emulation`, `get_rate_limiter`, and the `DirectRl` type alias.

use anyhow::Result;
use std::time::Duration;
use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;
use std::sync::OnceLock;
use tokio::time::sleep;

// ─── TLS 指纹客户端抽象 ────────────────────────────────────────────────────────
// stealth feature 启用时用 wreq（BoringSSL + Chrome TLS 指纹）；
// 否则使用标准 reqwest。对调用方完全透明。

#[cfg(feature = "stealth")]
pub(super) mod stealth_client {
    use anyhow::Result;
    use wreq::Client;
    use wreq_util::Emulation;

    /// 根据 UA 字符串选择匹配的浏览器指纹模拟目标
    pub(super) fn pick_emulation(ua: &str) -> Emulation {
        if ua.contains("Edg/") || ua.contains("Edge/") {
            Emulation::Edge134
        } else if ua.contains("Firefox/") {
            Emulation::Firefox136
        } else {
            // 默认 Chrome 最新稳定版指纹
            Emulation::Chrome136
        }
    }

    /// 构造 wreq::Client，携带 Chrome TLS 指纹
    pub fn build(
        ua: &str,
        proxy: Option<&str>,
        timeout: u64,
    ) -> Result<Client> {
        let emulation = pick_emulation(ua);

        let mut builder = Client::builder()
            .emulation(emulation)
            .user_agent(ua)
            .timeout(std::time::Duration::from_secs(timeout))
            .gzip(true);

        if let Some(p) = proxy {
            if !p.is_empty() {
                builder = builder.proxy(wreq::Proxy::all(p)?);
            }
        }

        Ok(builder.build()?)
    }
}

/// 统一客户端类型：stealth 时为 wreq::Client，否则为 reqwest::Client。
/// 内部通过 enum dispatch 隐藏差异，外部调用 `.get(url).send().await` 统一使用。
pub enum RateLimitedClient {
    #[cfg(feature = "stealth")]
    Stealth(wreq::Client),
    Standard(reqwest::Client),
}

impl RateLimitedClient {
    /// 发起 GET 请求，返回响应 bytes（内部统一处理）
    pub async fn get_bytes(
        &self,
        url: &str,
        referer: &str,
        retry_count: u32,
        retry_delay: u64,
    ) -> Result<bytes::Bytes> {
        let mut attempts = 0u32;
        loop {
            let result: Result<bytes::Bytes, anyhow::Error> = match self {
                #[cfg(feature = "stealth")]
                RateLimitedClient::Stealth(client) => {
                    client
                        .get(url)
                        .header("Referer", referer)
                        .header("Sec-Fetch-Dest", "document")
                        .header("Sec-Fetch-Mode", "navigate")
                        .header("Sec-Fetch-Site", "same-origin")
                        .send()
                        .await
                        .map_err(|e| anyhow::anyhow!("{}", e))?
                        .bytes()
                        .await
                        .map_err(|e| anyhow::anyhow!("{}", e))
                }
                RateLimitedClient::Standard(client) => {
                    client
                        .get(url)
                        .header("Referer", referer)
                        .header("Sec-Fetch-Dest", "document")
                        .header("Sec-Fetch-Mode", "navigate")
                        .header("Sec-Fetch-Site", "same-origin")
                        .send()
                        .await
                        .map_err(|e| anyhow::anyhow!("{}", e))?
                        .bytes()
                        .await
                        .map_err(|e| anyhow::anyhow!("{}", e))
                }
            };
            match result {
                Ok(b) => return Ok(b),
                Err(e) => {
                    attempts += 1;
                    if attempts >= retry_count {
                        return Err(e);
                    }
                    sleep(Duration::from_secs(retry_delay * attempts as u64)).await;
                }
            }
        }
    }
}

pub type DirectRl = RateLimiter<
    governor::state::NotKeyed,
    governor::state::InMemoryState,
    governor::clock::DefaultClock,
>;

/// 返回 per-rps 共享限速器（懒初始化，线程安全）。
/// rps = 0 时返回 None，调用方使用随机延迟。
pub fn get_rate_limiter(rps: u32) -> Option<std::sync::Arc<DirectRl>> {
    static LIMITERS: OnceLock<std::sync::RwLock<std::collections::HashMap<u32, std::sync::Arc<DirectRl>>>> = OnceLock::new();
    if rps == 0 { return None; }
    let map = LIMITERS.get_or_init(|| std::sync::RwLock::new(std::collections::HashMap::new()));
    // fast path
    {
        let r = map.read().unwrap();
        if let Some(rl) = r.get(&rps) {
            return Some(rl.clone());
        }
    }
    // slow path
    let mut w = map.write().unwrap();
    let rl = w.entry(rps).or_insert_with(|| {
        let n = NonZeroU32::new(rps).unwrap_or(NonZeroU32::new(1).unwrap());
        std::sync::Arc::new(RateLimiter::direct(Quota::per_second(n)))
    });
    Some(rl.clone())
}

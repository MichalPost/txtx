/// Extract the bare domain from a URL, e.g. "https://ffxs8.com/foo" → "ffxs8.com"
pub fn extract_domain(url: &str) -> String {
    url.split("://")
        .nth(1)
        .unwrap_or("")
        .split('/')
        .next()
        .unwrap_or("")
        .to_string()
}

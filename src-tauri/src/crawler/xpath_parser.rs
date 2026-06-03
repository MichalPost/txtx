use scraper::{Html, Selector};
use sxd_xpath::evaluate_xpath;

/// XPath-like text extraction using CSS-style scraper.
/// Translates simple XPath text() and @attr patterns to scraper selectors.
pub fn xpath_texts(html: &Html, xpath: &str) -> Vec<String> {
    if let Some(sel) = xpath_to_css(xpath) {
        if let Ok(selector) = Selector::parse(&sel) {
            let attr = xpath_attr(xpath);
            return html
                .select(&selector)
                .flat_map(|el| {
                    if let Some(a) = &attr {
                        el.value().attr(a).map(|v| v.to_string()).into_iter().collect::<Vec<_>>()
                    } else {
                        vec![el.text().collect::<String>().trim().to_string()]
                    }
                })
                .filter(|s| !s.is_empty())
                .collect();
        }
    }
    vec![]
}

/// Public alias kept for call-site compatibility.
pub fn xpath_texts_pub(html: &Html, xpath: &str) -> Vec<String> {
    xpath_texts(html, xpath)
}

/// Native XPath 1.0 evaluation via sxd-xpath (full expression support).
/// Falls back to CSS-based xpath_texts if the XPath engine fails.
pub fn xpath_texts_native(html_str: &str, xpath_expr: &str) -> Vec<String> {
    let results = (|| -> Option<Vec<String>> {
        let package = sxd_html::parse_html(html_str);
        let document = package.as_document();
        let value = evaluate_xpath(&document, xpath_expr).ok()?;
        match value {
            sxd_xpath::Value::Nodeset(nodeset) => {
                let items: Vec<String> = nodeset
                    .iter()
                    .map(|node| node.string_value().trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                Some(items)
            }
            sxd_xpath::Value::String(s) => {
                if s.trim().is_empty() { None } else { Some(vec![s.trim().to_string()]) }
            }
            _ => None,
        }
    })();

    match results {
        Some(items) if !items.is_empty() => items,
        _ => {
            let html = Html::parse_document(html_str);
            xpath_texts(&html, xpath_expr)
        }
    }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/// Extract the attribute name from an XPath like `.../@href`
fn xpath_attr(xpath: &str) -> Option<String> {
    if xpath.ends_with("/@href") { return Some("href".into()); }
    if xpath.ends_with("/@src")  { return Some("src".into());  }
    if let Some(pos) = xpath.rfind("/@") {
        return Some(xpath[pos + 2..].to_string());
    }
    None
}

/// Strip /text() or /@attr suffix, returning the pure element path.
fn strip_xpath_suffix(xpath: &str) -> &str {
    if let Some(pos) = xpath.rfind("/@") {
        return &xpath[..pos];
    }
    if let Some(s) = xpath.strip_suffix("/text()") {
        return s;
    }
    if let Some(s) = xpath.strip_suffix("text()") {
        return s.trim_end_matches('/');
    }
    xpath
}

/// Convert a single XPath path segment to a CSS selector segment.
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

/// Convert the XPath subset used in config files to a CSS selector.
///
/// Supported patterns:
///   - Absolute path:  /html/body/div[4]/div/p/text()
///   - Double-slash:   //p/text()  or  /html/body//p/text()
///   - @attr suffix:   /html/body/div/a/@href
///   - tag[n]:         → tag:nth-of-type(n)
pub fn xpath_to_css(xpath: &str) -> Option<String> {
    let base = strip_xpath_suffix(xpath);

    if base.is_empty() {
        return None;
    }

    // Pure //tag (single segment after //)
    if base.starts_with("//") && !base[2..].contains('/') {
        let tag = &base[2..];
        if !tag.is_empty() {
            return Some(xpath_part_to_css(tag));
        }
    }

    let mut result_parts: Vec<String> = Vec::new();
    let double_slash_segs: Vec<&str> = base.split("//").collect();

    for (seg_idx, seg) in double_slash_segs.iter().enumerate() {
        let parts: Vec<&str> = seg.split('/').filter(|s| !s.is_empty()).collect();
        let mut seg_css: Vec<String> = Vec::new();

        for part in &parts {
            if *part == "html" || *part == "body" { continue; }
            seg_css.push(xpath_part_to_css(part));
        }

        if seg_css.is_empty() {
            continue;
        }

        if seg_idx > 0 || !result_parts.is_empty() {
            result_parts.push(seg_css.join(" > "));
        } else {
            result_parts.push(seg_css.join(" > "));
        }
    }

    if result_parts.is_empty() {
        return None;
    }

    Some(result_parts.join(" "))
}

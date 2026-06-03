use regex::Regex;
use crate::models::ContentFilterConfig;

/// Strip ad lines and trailing navigation lines from chapter content.
/// Falls back safely when the filter removes too much content.
pub(crate) fn optimize_content(parts: Vec<String>, filter: &ContentFilterConfig) -> String {
    if parts.is_empty() { return String::new(); }

    let cleaned: Vec<String> = parts.into_iter()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    if cleaned.is_empty() { return String::new(); }

    let original_count = cleaned.len();

    let compiled: Vec<Regex> = filter.ad_patterns.iter()
        .filter_map(|p| Regex::new(p).ok())
        .collect();

    let mut filtered: Vec<String> = cleaned.iter()
        .filter(|line| !compiled.iter().any(|re| re.is_match(line)))
        .cloned()
        .collect();

    // Strip trailing navigation lines
    loop {
        match filtered.last() {
            Some(last) if filter.nav_keywords.iter().any(|kw| last.contains(kw.as_str())) => {
                filtered.pop();
            }
            _ => break,
        }
    }

    // Safety fallback: if too much was filtered, fall back to trimming only the last N lines
    if !filtered.is_empty()
        && (filtered.len() as f64) < (original_count as f64) * filter.safety_threshold
    {
        let mut fallback = cleaned;
        let remove_count = fallback.len().min(filter.fallback_trim_lines);
        let new_len = fallback.len() - remove_count;
        fallback.truncate(new_len);
        return fallback.join("\n");
    }

    filtered.join("\n")
}

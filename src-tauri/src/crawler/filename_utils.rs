/// Sanitize a filename by removing illegal characters.
pub fn sanitize_filename(name: &str) -> String {
    if name.is_empty() {
        return "Unknown_Novel".to_string();
    }
    let name = name.trim();
    // Remove content in parentheses
    let re_paren = regex::Regex::new(r"\(.*?\)|（.*?）").unwrap();
    let name = re_paren.replace_all(name, "");
    // Remove illegal filename chars
    let re_illegal = regex::Regex::new(r#"[\\/:*?"<>|\n\r\t]"#).unwrap();
    let name = re_illegal.replace_all(&name, "_");
    // Collapse whitespace
    let re_ws = regex::Regex::new(r"\s+").unwrap();
    let name = re_ws.replace_all(&name, " ");
    let name = name.trim().trim_end_matches('.').to_string();
    if name.is_empty() {
        "Untitled_Novel".to_string()
    } else {
        name
    }
}

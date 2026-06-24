use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: String, // ISO 8601
    pub extension: String,
}

/// List all book files (.txt, .epub, .mobi, .azw3) in dir
pub fn list_books(dir: &str) -> Result<Vec<BookFile>> {
    let path = Path::new(dir);
    if !path.exists() {
        return Ok(vec![]);
    }
    let mut books = Vec::new();
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let meta = entry.metadata()?;
        if !meta.is_file() {
            continue;
        }
        let fpath = entry.path();
        let ext = fpath
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !["txt", "epub", "mobi", "azw3"].contains(&ext.as_str()) {
            continue;
        }
        let name = fpath
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let modified = meta
            .modified()
            .ok()
            .map(|t| {
                let dt: chrono::DateTime<chrono::Local> = t.into();
                dt.to_rfc3339()
            })
            .unwrap_or_default();
        books.push(BookFile {
            name,
            path: fpath.to_string_lossy().to_string(),
            size: meta.len(),
            modified,
            extension: ext,
        });
    }
    books.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(books)
}

/// Delete a book file
pub fn delete_book(path: &str) -> Result<()> {
    std::fs::remove_file(path)?;
    Ok(())
}

/// Try to detect calibre ebook-convert executable.
/// Checks common paths on Windows and Unix, then falls back to PATH.
pub fn detect_calibre() -> Option<String> {
    let candidates: &[&str] = &[
        // Windows
        r"C:\Program Files\Calibre2\ebook-convert.exe",
        r"C:\Program Files (x86)\Calibre2\ebook-convert.exe",
        r"C:\Users\Public\Calibre2\ebook-convert.exe",
        // Unix / macOS
        "/usr/bin/ebook-convert",
        "/usr/local/bin/ebook-convert",
        "/Applications/calibre.app/Contents/MacOS/ebook-convert",
    ];
    for &p in candidates {
        if Path::new(p).exists() {
            return Some(p.to_string());
        }
    }
    // Also try PATH
    if let Ok(output) = std::process::Command::new("which")
        .arg("ebook-convert")
        .output()
    {
        if output.status.success() {
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !s.is_empty() {
                return Some(s);
            }
        }
    }
    None
}

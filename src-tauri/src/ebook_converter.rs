/// Ebook conversion support.
///
/// Supports:
///   - EPUB via the `epub-builder` crate (pure Rust, no external deps)
///   - MOBI/AZW3 via Calibre's `ebook-convert` CLI (optional, auto-detected)
///
/// If a format is requested but the required tool is unavailable, a warning
/// is logged and the step is skipped gracefully.

use std::path::{Path, PathBuf};
use anyhow::{Result, Context};
use regex::Regex;

// ─── Chapter extraction ───────────────────────────────────────────────────────

pub struct Chapter {
    pub title: String,
    pub content: String,
}

/// Split a TXT file into chapters based on common Chinese chapter heading patterns.
pub fn extract_chapters(txt: &str) -> Vec<Chapter> {
    let patterns = [
        r"^第[零一二三四五六七八九十百千万\d]+[章节回卷]\s*",
        r"^\d+[、.．]\s*",
    ];
    let compiled: Vec<Regex> = patterns.iter()
        .filter_map(|p| Regex::new(p).ok())
        .collect();

    let mut chapters: Vec<Chapter> = Vec::new();
    let mut current_title = "序章".to_string();
    let mut current_lines: Vec<&str> = Vec::new();

    for line in txt.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() { continue; }

        let is_heading = compiled.iter().any(|re| re.is_match(trimmed));
        if is_heading {
            if !current_lines.is_empty() {
                chapters.push(Chapter {
                    title: current_title.clone(),
                    content: current_lines.join("\n"),
                });
                current_lines.clear();
            }
            current_title = trimmed.to_string();
        } else {
            current_lines.push(trimmed);
        }
    }

    if !current_lines.is_empty() {
        chapters.push(Chapter {
            title: current_title,
            content: current_lines.join("\n"),
        });
    }

    // Fallback: no chapter headings found — treat whole file as one chapter
    if chapters.is_empty() {
        chapters.push(Chapter {
            title: "全文".to_string(),
            content: txt.to_string(),
        });
    }

    chapters
}

// ─── EPUB conversion ──────────────────────────────────────────────────────────

/// Convert a TXT file to EPUB.  Returns the path of the generated file.
pub fn convert_to_epub(txt_path: &Path, novel_name: &str) -> Result<PathBuf> {
    use epub_builder::{EpubBuilder, EpubContent, ZipLibrary};

    let txt = std::fs::read_to_string(txt_path)
        .with_context(|| format!("读取 TXT 文件失败: {}", txt_path.display()))?;

    let chapters = extract_chapters(&txt);

    let epub_path = txt_path.with_extension("epub");
    let out = std::fs::File::create(&epub_path)
        .with_context(|| format!("创建 EPUB 文件失败: {}", epub_path.display()))?;

    let mut builder = EpubBuilder::new(ZipLibrary::new().map_err(|e| anyhow::anyhow!("{}", e))?)
        .map_err(|e| anyhow::anyhow!("{}", e))?;
    builder.metadata("title", novel_name).map_err(|e| anyhow::anyhow!("{}", e))?;
    builder.metadata("lang", "zh").map_err(|e| anyhow::anyhow!("{}", e))?;

    // 尝试从正文前 5 行提取作者信息（格式：作者：xxx 或 作者:xxx）
    if let Some(author) = txt.lines().take(5).find_map(|line| {
        let line = line.trim();
        if line.starts_with("作者") {
            let after = line.trim_start_matches("作者").trim_start_matches(['：', ':']).trim();
            if !after.is_empty() { Some(after.to_string()) } else { None }
        } else {
            None
        }
    }) {
        let _ = builder.metadata("creator", &author);
    }

    for (i, ch) in chapters.iter().enumerate() {
        let html = format!(
            "<?xml version='1.0' encoding='utf-8'?>\
             <!DOCTYPE html>\
             <html xmlns='http://www.w3.org/1999/xhtml'>\
             <head><title>{title}</title></head>\
             <body><h2>{title}</h2>{body}</body></html>",
            title = html_escape(&ch.title),
            body = ch.content.lines()
                .map(|l| format!("<p>{}</p>", html_escape(l)))
                .collect::<Vec<_>>()
                .join("\n")
        );

        let filename = format!("chapter_{:04}.xhtml", i);
        builder.add_content(
            EpubContent::new(&filename, html.as_bytes())
                .title(&ch.title)
        ).map_err(|e| anyhow::anyhow!("{}", e))?;
    }

    builder.generate(out).map_err(|e| anyhow::anyhow!("{}", e))?;
    Ok(epub_path)
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
     .replace('<', "&lt;")
     .replace('>', "&gt;")
     .replace('"', "&quot;")
}

// ─── MOBI/AZW3 via Calibre CLI ───────────────────────────────────────────────

/// Find the `ebook-convert` binary from Calibre.
pub fn find_calibre() -> Option<PathBuf> {
    // 1. PATH
    if let Ok(p) = which::which("ebook-convert") {
        return Some(p);
    }
    // 2. Common install locations
    let candidates = [
        r"C:\Program Files\Calibre2\ebook-convert.exe",
        r"C:\Program Files (x86)\Calibre2\ebook-convert.exe",
        "/Applications/calibre.app/Contents/MacOS/ebook-convert",
        "/usr/bin/ebook-convert",
        "/usr/local/bin/ebook-convert",
    ];
    for c in &candidates {
        let p = PathBuf::from(c);
        if p.exists() { return Some(p); }
    }
    None
}

/// Convert a file using Calibre's `ebook-convert`.
/// `target_ext` should be e.g. "mobi" or "azw3".
pub fn convert_with_calibre(
    input: &Path,
    target_ext: &str,
    calibre_path: Option<&Path>,
) -> Result<PathBuf> {
    let binary = calibre_path
        .map(|p| p.to_path_buf())
        .or_else(find_calibre)
        .ok_or_else(|| anyhow::anyhow!("未找到 Calibre ebook-convert，请安装 Calibre 或在配置中指定路径"))?;

    let output = input.with_extension(target_ext);

    let status = std::process::Command::new(&binary)
        .arg(input)
        .arg(&output)
        .status()
        .with_context(|| format!("运行 ebook-convert 失败: {}", binary.display()))?;

    if !status.success() {
        return Err(anyhow::anyhow!(
            "ebook-convert 返回错误码: {}",
            status.code().unwrap_or(-1)
        ));
    }

    Ok(output)
}

// ─── Unified entry point ──────────────────────────────────────────────────────

/// Convert `txt_path` to the requested format.
/// Returns the output path on success, or an error message (non-fatal).
pub async fn convert(
    txt_path: PathBuf,
    format: &str,
    calibre_path: Option<PathBuf>,
) -> Result<PathBuf> {
    let novel_name = txt_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Novel")
        .to_string();

    match format {
        "epub" => {
            tokio::task::spawn_blocking(move || {
                convert_to_epub(&txt_path, &novel_name)
            }).await?
        }
        "mobi" | "azw3" => {
            let fmt = format.to_string();
            tokio::task::spawn_blocking(move || {
                convert_with_calibre(&txt_path, &fmt, calibre_path.as_deref())
            }).await?
        }
        other => Err(anyhow::anyhow!("不支持的电子书格式: {}", other)),
    }
}

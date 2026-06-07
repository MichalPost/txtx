/// 合并多个 txt 文件，按顺序拼接，文件间加换行分隔
pub async fn merge_files(paths: Vec<String>, output: String) -> anyhow::Result<String> {
    use tokio::io::AsyncWriteExt;
    let mut f = tokio::fs::File::create(&output).await?;
    let count = paths.len();
    for path in &paths {
        let content = tokio::fs::read_to_string(path).await.unwrap_or_default();
        f.write_all(content.as_bytes()).await?;
        // Ensure a blank line between files
        if !content.ends_with('\n') {
            f.write_all(b"\n").await?;
        }
        f.write_all(b"\n").await?;
    }
    f.flush().await?;
    Ok(format!("已合并 {} 个文件到 {}", count, output))
}

/// 按章节标题切割，生成 <stem>_ch001.txt 系列文件，输出到同目录
/// pattern: 自定义正则（默认匹配"第X章/第X节"等常见格式）
pub async fn split_file(path: String, pattern: Option<String>) -> anyhow::Result<Vec<String>> {
    let content = tokio::fs::read_to_string(&path).await?;
    let dir = std::path::Path::new(&path)
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."));
    let stem = std::path::Path::new(&path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");

    let pat = pattern
        .as_deref()
        .unwrap_or(r"^第[零一二三四五六七八九十百千\d]+[章节回折幕]");
    let re = regex::Regex::new(pat)?;

    let mut chapters: Vec<(String, String)> = Vec::new();
    let mut current_title = String::from("前言");
    let mut current_content = String::new();

    for line in content.lines() {
        if re.is_match(line) {
            if !current_content.trim().is_empty() {
                chapters.push((current_title.clone(), current_content.clone()));
            }
            current_title = line.to_string();
            current_content = format!("{}\n", line);
        } else {
            current_content.push_str(line);
            current_content.push('\n');
        }
    }
    if !current_content.trim().is_empty() {
        chapters.push((current_title, current_content));
    }

    if chapters.is_empty() {
        return Err(anyhow::anyhow!(
            "未识别到章节结构，请检查分割规则（当前正则：{}）",
            pat
        ));
    }

    let mut outputs = Vec::new();
    for (i, (_title, ch_content)) in chapters.iter().enumerate() {
        let fname = dir.join(format!("{}_ch{:03}.txt", stem, i + 1));
        tokio::fs::write(&fname, ch_content.as_bytes()).await?;
        outputs.push(fname.to_string_lossy().to_string());
    }
    Ok(outputs)
}

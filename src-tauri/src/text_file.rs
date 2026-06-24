use anyhow::{anyhow, Context, Result};
use encoding_rs::{BIG5, GBK, UTF_8};
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextEncodingKind {
    Utf8,
    Gbk,
    Big5,
}

impl TextEncodingKind {
    pub fn label(self) -> &'static str {
        match self {
            TextEncodingKind::Utf8 => "UTF-8",
            TextEncodingKind::Gbk => "GBK",
            TextEncodingKind::Big5 => "Big5",
        }
    }
}

pub struct DecodedTextFile {
    pub content: String,
    pub encoding: TextEncodingKind,
}

fn decode_loss_score(text: &str) -> usize {
    text.chars().filter(|ch| *ch == '\u{fffd}').count()
}

fn looks_like_cjk(ch: char) -> bool {
    matches!(
        ch as u32,
        0x3400..=0x4DBF | 0x4E00..=0x9FFF | 0xF900..=0xFAFF
    )
}

fn traditional_marker_score(text: &str) -> usize {
    const MARKERS: &[char] = &[
        '臺', '灣', '萬', '與', '專', '業', '裡', '說', '會', '這', '龍', '貓', '門', '頭',
        '體', '節', '畫', '書', '網', '頁', '後', '續',
    ];
    text.chars().filter(|ch| MARKERS.contains(ch)).count()
}

fn text_plausibility_score(text: &str) -> isize {
    let mut score = 0isize;
    for ch in text.chars() {
        if looks_like_cjk(ch) {
            score += 2;
            continue;
        }
        if ch.is_ascii_alphanumeric() {
            score -= 1;
            continue;
        }
        if ch.is_control() && ch != '\n' && ch != '\r' && ch != '\t' {
            score -= 3;
        }
    }
    score + (traditional_marker_score(text) as isize * 3)
}

fn detect_text_encoding(bytes: &[u8]) -> TextEncodingKind {
    if std::str::from_utf8(bytes).is_ok() {
        return TextEncodingKind::Utf8;
    }

    let (gbk_text, _, _) = GBK.decode(bytes);
    let (big5_text, _, _) = BIG5.decode(bytes);
    let gbk_score = decode_loss_score(gbk_text.as_ref());
    let big5_score = decode_loss_score(big5_text.as_ref());

    if gbk_score == big5_score {
        let gbk_plausibility = text_plausibility_score(gbk_text.as_ref());
        let big5_plausibility = text_plausibility_score(big5_text.as_ref());
        if big5_plausibility > gbk_plausibility {
            return TextEncodingKind::Big5;
        }
        TextEncodingKind::Gbk
    } else if gbk_score < big5_score {
        TextEncodingKind::Gbk
    } else {
        TextEncodingKind::Big5
    }
}

fn decode_bytes(bytes: &[u8], encoding: TextEncodingKind) -> String {
    match encoding {
        TextEncodingKind::Utf8 => UTF_8.decode(bytes).0.into_owned(),
        TextEncodingKind::Gbk => GBK.decode(bytes).0.into_owned(),
        TextEncodingKind::Big5 => BIG5.decode(bytes).0.into_owned(),
    }
}

pub async fn read_text_file_auto(path: impl AsRef<Path>) -> Result<DecodedTextFile> {
    let path_ref = path.as_ref();
    let bytes = tokio::fs::read(path_ref)
        .await
        .with_context(|| format!("读取文件失败: {}", path_ref.display()))?;

    if bytes.is_empty() {
        return Err(anyhow!("文件为空: {}", path_ref.display()));
    }

    let encoding = detect_text_encoding(&bytes);
    let content = decode_bytes(&bytes, encoding);

    Ok(DecodedTextFile { content, encoding })
}

#[cfg(test)]
mod tests {
    use super::{decode_bytes, detect_text_encoding, TextEncodingKind};
    use encoding_rs::{BIG5, GBK};

    #[test]
    fn detect_text_encoding_prefers_utf8_for_utf8_text() {
        let bytes = "简体文本".as_bytes();

        let detected = detect_text_encoding(bytes);

        assert_eq!(detected, TextEncodingKind::Utf8);
    }

    #[test]
    fn detect_text_encoding_supports_gbk_text() {
        let (bytes, _, _) = GBK.encode("繁體小說");

        let detected = detect_text_encoding(bytes.as_ref());
        let decoded = decode_bytes(bytes.as_ref(), detected);

        assert_eq!(detected, TextEncodingKind::Gbk);
        assert!(decoded.contains("繁體小說"));
    }

    #[test]
    fn detect_text_encoding_supports_big5_text() {
        let (bytes, _, _) = BIG5.encode("臺灣章節");

        let detected = detect_text_encoding(bytes.as_ref());
        let decoded = decode_bytes(bytes.as_ref(), detected);

        assert_eq!(detected, TextEncodingKind::Big5);
        assert!(decoded.contains("臺灣章節"));
    }
}

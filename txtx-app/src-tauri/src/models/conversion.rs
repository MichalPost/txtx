use serde::{Deserialize, Serialize};
use super::config::default_true;

// ─── Text conversion config ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TextConversionConfig {
    #[serde(default)]
    pub enabled: bool,
    /// Convert traditional Chinese to simplified
    #[serde(default)]
    pub traditional_to_simplified: bool,
    /// Auto-detect whether conversion is needed
    #[serde(default = "default_true")]
    pub auto_detect: bool,
}

// ─── Ebook conversion config ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EbookConversionConfig {
    #[serde(default)]
    pub enabled: bool,
    /// Formats to convert to: "epub", "mobi"
    #[serde(default)]
    pub formats: Vec<String>,
    /// Path to calibre's ebook-convert binary (optional, auto-detected if empty)
    #[serde(default)]
    pub calibre_path: Option<String>,
}

//! 繁简转换模块
//! 使用 zhconv crate，基于 MediaWiki/Wikipedia + OpenCC 规则集
//! 支持词组级转换（如「軟件」→「软件」），覆盖率远超字符映射表方案。

use zhconv::{zhconv, Variant};

/// 检测文本是否含有繁体字（通过尝试转换后比对）
pub fn has_traditional(text: &str) -> bool {
    let converted = zhconv(text, Variant::ZhHans);
    converted != text
}

/// 繁体 → 简体转换（台湾/香港繁体均支持，词组级精度）
pub fn traditional_to_simplified(text: &str) -> String {
    zhconv(text, Variant::ZhHans)
}

/// 检测并按需转换。返回 (转换后文本, 是否发生了转换)
pub fn detect_and_convert(text: &str, auto_detect: bool) -> (String, bool) {
    if auto_detect {
        if has_traditional(text) {
            (traditional_to_simplified(text), true)
        } else {
            (text.to_string(), false)
        }
    } else {
        let converted = traditional_to_simplified(text);
        let changed = converted != text;
        (converted, changed)
    }
}

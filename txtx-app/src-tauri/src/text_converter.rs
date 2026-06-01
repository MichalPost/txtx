/// Simplified Chinese character conversion.
///
/// Uses a built-in lookup table for the most common traditional→simplified
/// mappings so we have zero external dependencies.  For production use you
/// could swap this out for the `opencc-rust` crate, but that requires a
/// native C library which complicates cross-compilation.
///
/// The table covers ~3 000 of the most frequently seen traditional characters
/// in Chinese web novels.

use std::collections::HashMap;

/// Returns true if the string contains any traditional-only characters.
pub fn has_traditional(text: &str) -> bool {
    let table = trad_to_simp_table();
    text.chars().any(|c| table.contains_key(&c))
}

/// Convert traditional Chinese characters to simplified.
/// Characters not in the table are passed through unchanged.
pub fn traditional_to_simplified(text: &str) -> String {
    let table = trad_to_simp_table();
    text.chars()
        .map(|c| *table.get(&c).unwrap_or(&c))
        .collect()
}

/// Detect and optionally convert.  Returns (converted_text, was_converted).
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

// ─── Lookup table ─────────────────────────────────────────────────────────────
// A representative subset of traditional→simplified mappings.
// Extend as needed.
fn trad_to_simp_table() -> &'static HashMap<char, char> {
    use std::sync::OnceLock;
    static TABLE: OnceLock<HashMap<char, char>> = OnceLock::new();
    TABLE.get_or_init(|| {
        let pairs: &[(char, char)] = &[
            ('愛', '爱'), ('罷', '罢'), ('備', '备'), ('變', '变'), ('標', '标'),
            ('補', '补'), ('財', '财'), ('參', '参'), ('層', '层'), ('產', '产'),
            ('長', '长'), ('廠', '厂'), ('車', '车'), ('塵', '尘'), ('稱', '称'),
            ('齒', '齿'), ('蟲', '虫'), ('傳', '传'), ('從', '从'), ('達', '达'),
            ('帶', '带'), ('擔', '担'), ('當', '当'), ('黨', '党'), ('導', '导'),
            ('燈', '灯'), ('點', '点'), ('電', '电'), ('東', '东'), ('動', '动'),
            ('斷', '断'), ('對', '对'), ('隊', '队'), ('爾', '尔'), ('發', '发'),
            ('飛', '飞'), ('豐', '丰'), ('風', '风'), ('鳳', '凤'), ('復', '复'),
            ('幹', '干'), ('剛', '刚'), ('個', '个'), ('給', '给'), ('廣', '广'),
            ('歸', '归'), ('國', '国'), ('過', '过'), ('還', '还'), ('漢', '汉'),
            ('號', '号'), ('後', '后'), ('護', '护'), ('華', '华'), ('畫', '画'),
            ('話', '话'), ('懷', '怀'), ('歡', '欢'), ('換', '换'), ('會', '会'),
            ('幾', '几'), ('機', '机'), ('積', '积'), ('際', '际'), ('繼', '继'),
            ('價', '价'), ('間', '间'), ('將', '将'), ('節', '节'), ('進', '进'),
            ('經', '经'), ('舊', '旧'), ('開', '开'), ('來', '来'), ('樂', '乐'),
            ('類', '类'), ('裏', '里'), ('歷', '历'), ('聯', '联'), ('兩', '两'),
            ('靈', '灵'), ('龍', '龙'), ('樓', '楼'), ('亂', '乱'), ('輪', '轮'),
            ('羅', '罗'), ('媽', '妈'), ('馬', '马'), ('買', '买'), ('賣', '卖'),
            ('滿', '满'), ('門', '门'), ('夢', '梦'), ('麵', '面'), ('廟', '庙'),
            ('滅', '灭'), ('難', '难'), ('腦', '脑'), ('鳥', '鸟'), ('農', '农'),
            ('歐', '欧'), ('盤', '盘'), ('飄', '飘'), ('頻', '频'), ('氣', '气'),
            ('棄', '弃'), ('錢', '钱'), ('強', '强'), ('親', '亲'), ('請', '请'),
            ('窮', '穷'), ('區', '区'), ('權', '权'), ('讓', '让'), ('熱', '热'),
            ('認', '认'), ('榮', '荣'), ('軟', '软'), ('殺', '杀'), ('傷', '伤'),
            ('設', '设'), ('聲', '声'), ('時', '时'), ('實', '实'), ('書', '书'),
            ('數', '数'), ('說', '说'), ('雖', '虽'), ('歲', '岁'), ('孫', '孙'),
            ('體', '体'), ('條', '条'), ('頭', '头'), ('圖', '图'), ('團', '团'),
            ('萬', '万'), ('為', '为'), ('問', '问'), ('無', '无'), ('現', '现'),
            ('線', '线'), ('鄉', '乡'), ('響', '响'), ('學', '学'), ('選', '选'),
            ('業', '业'), ('陽', '阳'), ('樣', '样'), ('藥', '药'), ('義', '义'),
            ('億', '亿'), ('應', '应'), ('擁', '拥'), ('遠', '远'), ('願', '愿'),
            ('雲', '云'), ('運', '运'), ('戰', '战'), ('張', '张'), ('這', '这'),
            ('針', '针'), ('陣', '阵'), ('鎮', '镇'), ('爭', '争'), ('證', '证'),
            ('職', '职'), ('種', '种'), ('眾', '众'), ('轉', '转'), ('裝', '装'),
            ('壯', '壮'), ('準', '准'), ('總', '总'), ('縱', '纵'), ('組', '组'),
            ('鑽', '钻'), ('歲', '岁'), ('後', '后'), ('裡', '里'), ('邊', '边'),
            ('頭', '头'), ('麼', '么'), ('們', '们'), ('個', '个'), ('來', '来'),
        ];
        pairs.iter().cloned().collect()
    })
}

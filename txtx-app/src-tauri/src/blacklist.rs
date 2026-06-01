use regex::Regex;
use crate::models::BlacklistConfig;

pub struct Blacklist {
    keywords: Vec<String>,
    compiled_regex: Vec<Regex>,
    // Grading: strict / moderate / mild keyword lists (already lowercased if needed)
    grading_strict: Vec<String>,
    grading_moderate: Vec<String>,
    grading_mild: Vec<String>,
    filter_level: FilterLevel,
    case_insensitive: bool,
    fuzzy_match: bool,
    regex_match: bool,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum FilterLevel {
    None,
    Strict,
    Moderate,
    Mild,
}

impl FilterLevel {
    fn from_str(s: &str) -> Self {
        match s {
            "strict" => Self::Strict,
            "moderate" => Self::Moderate,
            "mild" => Self::Mild,
            _ => Self::None,
        }
    }
}

fn maybe_lower(words: &[String], lower: bool) -> Vec<String> {
    if lower {
        words.iter().map(|w| w.to_lowercase()).collect()
    } else {
        words.to_vec()
    }
}

impl Blacklist {
    pub fn new(cfg: &BlacklistConfig) -> Self {
        let ci = cfg.case_insensitive;

        let keywords = maybe_lower(&cfg.keywords, ci);

        let compiled_regex = if cfg.regex_match {
            cfg.regex_patterns
                .iter()
                .filter_map(|p| Regex::new(p).ok())
                .collect()
        } else {
            vec![]
        };

        let (grading_strict, grading_moderate, grading_mild) =
            if let Some(gr) = &cfg.grading_rules {
                (
                    maybe_lower(&gr.strict, ci),
                    maybe_lower(&gr.moderate, ci),
                    maybe_lower(&gr.mild, ci),
                )
            } else {
                (vec![], vec![], vec![])
            };

        Self {
            keywords,
            compiled_regex,
            grading_strict,
            grading_moderate,
            grading_mild,
            filter_level: FilterLevel::from_str(&cfg.filter_level),
            case_insensitive: ci,
            fuzzy_match: cfg.fuzzy_match,
            regex_match: cfg.regex_match,
        }
    }

    /// Returns (is_blocked, reason)
    pub fn is_blocked(&self, name: &str) -> (bool, String) {
        let check_name = if self.case_insensitive {
            name.to_lowercase()
        } else {
            name.to_string()
        };

        // 1. Keyword check
        for kw in &self.keywords {
            let matched = if self.fuzzy_match {
                check_name.contains(kw.as_str())
            } else {
                &check_name == kw
            };
            if matched {
                return (true, format!("keyword:{}", kw));
            }
        }

        // 2. Regex check
        if self.regex_match {
            for re in &self.compiled_regex {
                if re.is_match(name) {
                    return (true, format!("regex:{}", re.as_str()));
                }
            }
        }

        // 3. Grading rules check
        if self.filter_level != FilterLevel::None {
            // Determine which grade buckets to check based on filter_level
            // strict  → only strict
            // moderate → strict + moderate
            // mild    → strict + moderate + mild
            let buckets: &[&[String]] = match self.filter_level {
                FilterLevel::Strict => &[&self.grading_strict],
                FilterLevel::Moderate => &[&self.grading_strict, &self.grading_moderate],
                FilterLevel::Mild => &[
                    &self.grading_strict,
                    &self.grading_moderate,
                    &self.grading_mild,
                ],
                FilterLevel::None => &[],
            };

            for bucket in buckets {
                for kw in *bucket {
                    let matched = if self.fuzzy_match {
                        check_name.contains(kw.as_str())
                    } else {
                        &check_name == kw
                    };
                    if matched {
                        return (true, format!("grading:{}", kw));
                    }
                }
            }
        }

        (false, String::new())
    }
}

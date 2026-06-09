use anyhow::Result;
use rusqlite::{params, Connection};
use std::collections::HashMap;

use crate::models::{SiteAdRulesConfig, WebsiteConfig};

// ─── Websites ─────────────────────────────────────────────────────────────────

pub(super) fn load_websites_inner(conn: &Connection) -> Result<HashMap<String, WebsiteConfig>> {
    // Soft migrations: add columns if they don't exist yet (safe for existing DBs)
    let _ = conn.execute_batch(
        "ALTER TABLE websites ADD COLUMN chapter_next_page_xpath TEXT NOT NULL DEFAULT '';",
    );
    let _ =
        conn.execute_batch("ALTER TABLE websites ADD COLUMN encoding TEXT NOT NULL DEFAULT '';");
    let _ = conn
        .execute_batch("ALTER TABLE websites ADD COLUMN book_intro_x TEXT NOT NULL DEFAULT '';");
    let _ = conn
        .execute_batch("ALTER TABLE websites ADD COLUMN site_ad_rules TEXT NOT NULL DEFAULT '{}';");

    let mut stmt = conn.prepare(
        "SELECT key, enabled, domain_name, release_date, release_url, list_novel_name,
                novel_content, novel_name_x, chapter_url_x, page_list, special_mode,
                novel_content_fallbacks, chapter_next_page_xpath, encoding, book_intro_x,
                site_ad_rules
         FROM websites",
    )?;
    let rows = stmt.query_map([], |row| {
        let key: String = row.get(0)?;
        let enabled: bool = row.get::<_, i64>(1)? != 0;
        let domain_name: String = row.get(2)?;
        let release_date: String = row.get(3)?;
        let release_url: String = row.get(4)?;
        let list_novel_name: String = row.get(5)?;
        let novel_content: String = row.get(6)?;
        let novel_name_x: String = row.get(7)?;
        let chapter_url_x: String = row.get(8)?;
        let page_list_json: String = row.get(9)?;
        let special_mode: String = row.get(10)?;
        let fallbacks_json: String = row.get(11)?;
        let chapter_next_page_xpath: String = row.get(12).unwrap_or_default();
        let encoding: String = row.get(13).unwrap_or_default();
        let book_intro_x: String = row.get(14).unwrap_or_default();
        let site_ad_rules_json: String = row.get(15).unwrap_or_else(|_| "{}".to_string());

        let page_list: Vec<String> = serde_json::from_str(&page_list_json).unwrap_or_default();
        let novel_content_fallbacks: Vec<String> =
            serde_json::from_str(&fallbacks_json).unwrap_or_default();
        let site_ad_rules: SiteAdRulesConfig =
            serde_json::from_str(&site_ad_rules_json).unwrap_or_default();

        Ok((
            key,
            WebsiteConfig {
                enabled,
                domain_name,
                release_date,
                release_url,
                list_novel_name,
                novel_content,
                novel_name_x,
                chapter_url_x,
                page_list,
                special_mode,
                novel_content_fallbacks,
                encoding,
                chapter_next_page_xpath,
                book_intro_x,
                site_ad_rules,
            },
        ))
    })?;

    let mut map = HashMap::new();
    for row in rows {
        let (key, site) = row?;
        map.insert(key, site);
    }
    Ok(map)
}

/// Replace ALL website rows with the given HashMap (full sync).
pub(super) fn save_all_websites_inner(
    conn: &Connection,
    websites: &HashMap<String, WebsiteConfig>,
) -> Result<()> {
    // Delete rows that no longer exist
    let keys_json = serde_json::to_string(&websites.keys().collect::<Vec<_>>())?;
    // SQLite doesn't support NOT IN with a JSON array directly, so we delete-then-insert
    conn.execute("DELETE FROM websites", [])?;

    for (key, site) in websites {
        let page_list = serde_json::to_string(&site.page_list)?;
        let fallbacks = serde_json::to_string(&site.novel_content_fallbacks)?;
        let site_ad_rules = serde_json::to_string(&site.site_ad_rules)?;
        conn.execute(
            "INSERT INTO websites (key, enabled, domain_name, release_date, release_url,
                list_novel_name, novel_content, novel_name_x, chapter_url_x,
                page_list, special_mode, novel_content_fallbacks, chapter_next_page_xpath,
                encoding, book_intro_x, site_ad_rules)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                key,
                site.enabled as i64,
                site.domain_name,
                site.release_date,
                site.release_url,
                site.list_novel_name,
                site.novel_content,
                site.novel_name_x,
                site.chapter_url_x,
                page_list,
                site.special_mode,
                fallbacks,
                site.chapter_next_page_xpath,
                site.encoding,
                site.book_intro_x,
                site_ad_rules,
            ],
        )?;
    }
    let _ = keys_json; // suppress unused warning
    Ok(())
}

pub(super) fn save_rate_limit_rules(
    conn: &Connection,
    rules: &[crate::models::filters::RateLimitRule],
) -> Result<()> {
    conn.execute("DELETE FROM rate_limit_rules", [])?;
    for (i, rule) in rules.iter().enumerate() {
        let domains_json = serde_json::to_string(&rule.domains)?;
        let ua_pool_json = serde_json::to_string(&rule.ua_pool)?;
        conn.execute(
            "INSERT INTO rate_limit_rules (sort_order, name, domains, delay_min, delay_max, rps, ua_pool, stealth)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                i as i64,
                rule.name,
                domains_json,
                rule.delay_min_ms as i64,
                rule.delay_max_ms as i64,
                rule.requests_per_second as i64,
                ua_pool_json,
                rule.stealth as i64,
            ],
        )?;
    }
    Ok(())
}

pub(super) fn load_rate_limit_rules(
    conn: &Connection,
) -> Vec<crate::models::filters::RateLimitRule> {
    let Ok(mut stmt) = conn.prepare(
        "SELECT name, domains, delay_min, delay_max, rps, ua_pool, stealth
         FROM rate_limit_rules ORDER BY sort_order ASC",
    ) else {
        return vec![];
    };

    let rows = stmt.query_map([], |row| {
        let name: String = row.get(0)?;
        let domains_json: String = row.get(1)?;
        let delay_min: u64 = row.get::<_, i64>(2)? as u64;
        let delay_max: u64 = row.get::<_, i64>(3)? as u64;
        let rps: u32 = row.get::<_, i64>(4)? as u32;
        let ua_pool_json: String = row.get(5)?;
        let stealth: bool = row.get::<_, i64>(6)? != 0;
        let domains = serde_json::from_str(&domains_json).unwrap_or_default();
        let ua_pool = serde_json::from_str(&ua_pool_json).unwrap_or_default();
        Ok(crate::models::filters::RateLimitRule {
            name,
            domains,
            delay_min_ms: delay_min,
            delay_max_ms: delay_max,
            requests_per_second: rps,
            ua_pool,
            stealth,
        })
    });
    rows.ok()
        .map(|iter| iter.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

import type { WebsiteConfig } from "@/types";

// ─── Default for new sites ─────────────────────────────────────────────────────

export const DEFAULT_SITE: WebsiteConfig = {
  enabled: true,
  domain_name: "https://",
  release_date: "",
  release_url: "",
  list_novel_name: "",
  novel_content: "",
  novel_name_x: "",
  chapter_url_x: "",
  page_list: ["/tongren"],
  special_mode: "normal",
  novel_content_fallbacks: [],
  encoding: "",
  site_ad_rules: {
    enabled: true,
    xpath_rules: [],
    regex_rules: [],
    nav_keywords: [],
    trim_head: 0,
    trim_tail: 0,
  },
};

export function generateSiteKey(existingKeys: string[]): string {
  let index = existingKeys.length + 1;
  let key = `web${index}`;
  while (existingKeys.includes(key)) {
    index += 1;
    key = `web${index}`;
  }
  return key;
}

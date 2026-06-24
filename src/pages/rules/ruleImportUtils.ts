import type { WebsiteConfig } from "@/types";

export interface RuleImportPlan {
  merged: Record<string, WebsiteConfig>;
  importedCount: number;
  replacedCount: number;
  skippedCount: number;
  replacedKeys: string[];
}

export function extractRuleHostname(domainName: string) {
  try {
    return new URL(domainName).hostname;
  } catch {
    return domainName.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

export function buildRuleImportPlan(
  currentWebsites: Record<string, WebsiteConfig>,
  incomingWebsites: Record<string, WebsiteConfig>,
): RuleImportPlan {
  const merged = { ...currentWebsites };
  let importedCount = 0;
  let replacedCount = 0;
  let skippedCount = 0;
  const replacedKeys: string[] = [];

  for (const [incomingKey, incomingSite] of Object.entries(incomingWebsites)) {
    if (!incomingSite || typeof incomingSite.domain_name !== "string") {
      skippedCount += 1;
      continue;
    }

    const normalizedKey = incomingKey.trim();
    const hostname = extractRuleHostname(incomingSite.domain_name);
    if (!normalizedKey || !hostname) {
      skippedCount += 1;
      continue;
    }

    const existingSameKey = merged[normalizedKey];
    const existingSameHostnameKey = Object.entries(merged).find(([siteKey, site]) => {
      if (siteKey === normalizedKey) return false;
      return extractRuleHostname(site.domain_name) === hostname;
    })?.[0];

    if (existingSameHostnameKey) {
      skippedCount += 1;
      continue;
    }

    merged[normalizedKey] = incomingSite;
    if (existingSameKey) {
      replacedCount += 1;
      replacedKeys.push(normalizedKey);
    } else {
      importedCount += 1;
    }
  }

  return {
    merged,
    importedCount,
    replacedCount,
    skippedCount,
    replacedKeys,
  };
}

export function buildStarterRuleTemplate(): Record<string, WebsiteConfig> {
  return {
    example_site: {
      enabled: true,
      domain_name: "https://example.com",
      release_date: "//time/text()",
      release_url: "//a[contains(@href, '/book/')]/@href",
      list_novel_name: "//a[contains(@href, '/book/')]/text()",
      novel_name_x: "//h1/text()",
      chapter_url_x: "//a[contains(@href, '/chapter/')]/@href",
      novel_content: "//div[contains(@class, 'chapter-content')]//text()",
      page_list: ["/updates", "/books"],
      special_mode: "normal",
      encoding: "",
      novel_content_fallbacks: ["//article//text()", "//main//p/text()"],
      book_intro_x: "//meta[@name='description']/@content",
      site_ad_rules: {
        enabled: true,
        xpath_rules: ["//script", "//style", "//div[contains(@class, 'ad')]"],
        regex_rules: ["本章未完.*$", "请收藏本站.*$"],
        nav_keywords: ["上一章", "下一章", "返回目录"],
        trim_head: 0,
        trim_tail: 0,
      },
    },
  };
}

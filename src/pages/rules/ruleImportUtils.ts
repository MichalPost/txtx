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

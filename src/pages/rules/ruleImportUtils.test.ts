import assert from "node:assert/strict";
import test from "node:test";

import type { WebsiteConfig } from "@/types";

import { buildRuleImportPlan, extractRuleHostname } from "./ruleImportUtils.ts";

function makeSite(overrides: Partial<WebsiteConfig> = {}): WebsiteConfig {
  return {
    enabled: overrides.enabled ?? true,
    domain_name: overrides.domain_name ?? "https://example.com",
    release_date: overrides.release_date ?? "",
    release_url: overrides.release_url ?? "",
    list_novel_name: overrides.list_novel_name ?? "",
    novel_content: overrides.novel_content ?? "",
    novel_name_x: overrides.novel_name_x ?? "",
    chapter_url_x: overrides.chapter_url_x ?? "",
    page_list: overrides.page_list ?? [],
    special_mode: overrides.special_mode ?? "normal",
    novel_content_fallbacks: overrides.novel_content_fallbacks ?? [],
    encoding: overrides.encoding ?? "",
    site_ad_rules: overrides.site_ad_rules,
  };
}

test("extractRuleHostname normalizes urls and plain domains", () => {
  assert.equal(extractRuleHostname("https://example.com/path"), "example.com");
  assert.equal(extractRuleHostname("plain.example.com/path"), "plain.example.com");
});

test("buildRuleImportPlan counts imports, replacements, and skipped duplicate domains", () => {
  const current = {
    alpha: makeSite({ domain_name: "https://alpha.com" }),
    beta: makeSite({ domain_name: "https://beta.com" }),
  };
  const incoming = {
    beta: makeSite({ domain_name: "https://beta-replaced.com" }),
    gamma: makeSite({ domain_name: "https://gamma.com" }),
    dupe: makeSite({ domain_name: "https://alpha.com" }),
    invalid: makeSite({ domain_name: "" }),
  };

  const plan = buildRuleImportPlan(current, incoming);

  assert.equal(plan.importedCount, 1);
  assert.equal(plan.replacedCount, 1);
  assert.equal(plan.skippedCount, 2);
  assert.deepEqual(plan.replacedKeys, ["beta"]);
  assert.equal(plan.merged.gamma?.domain_name, "https://gamma.com");
  assert.equal(plan.merged.beta?.domain_name, "https://beta-replaced.com");
  assert.equal(plan.merged.dupe, undefined);
});

import assert from "node:assert/strict";
import test from "node:test";

import type { AppConfig } from "@/types";

import {
  buildSettingsChangeSummary,
  configToForm,
  parseImportedConfig,
  settingsSchema,
} from "./settingsSchema.ts";

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const config: AppConfig = {
    paths: {
      base_dir: "D:/books",
      temp_dir: "D:/books/.tmp",
      log_dir: "D:/books/logs",
    },
    network: {
      user_agent: "Mozilla/5.0 txtx test agent",
      proxy: null,
      retry_count: 3,
      retry_delay: 2,
      timeout: 30,
      encoding_map: {},
    },
    concurrency: {
      novel_threads: 2,
      chapter_threads: 8,
      max_connections_per_host: 4,
      connection_pool_size: 32,
    },
    filtering: {
      days_limit: 30,
      last_download_date: null,
      min_days_limit: 1,
      site_priority: {},
    },
    blacklist: {
      enabled: true,
      filter_level: "moderate",
      case_insensitive: true,
      fuzzy_match: false,
      regex_match: true,
      tag_filter: false,
      filtered_tags: [],
      keywords: [],
      regex_patterns: [],
      grading_rules: { strict: [], moderate: [], mild: [] },
      whitelist: [],
    },
    websites: {},
    text_conversion: {
      enabled: true,
      traditional_to_simplified: true,
      auto_detect: true,
    },
    ebook_conversion: {
      enabled: false,
      formats: [],
      calibre_path: null,
    },
    content_filter: {
      ad_patterns: [],
      nav_keywords: [],
      safety_threshold: 0.3,
      fallback_trim_lines: 2,
    },
    rate_limit: {
      rules: [],
    },
    advanced_network: {
      pool_idle_timeout_secs: 90,
      tcp_keepalive_secs: 60,
      min_chapter_bytes: 1024,
      chapter_fail_threshold: 0.05,
    },
    post_process: {
      enabled: false,
      script: "",
      run_on_batch_done: true,
    },
  };

  return { ...config, ...overrides };
}

function makeWebsite() {
  return {
    enabled: true,
    domain_name: "https://example.com",
    release_date: "//time/text()",
    release_url: "//a/@href",
    list_novel_name: "//a/text()",
    novel_content: "//article//text()",
    novel_name_x: "//h1/text()",
    chapter_url_x: "//a[contains(@href, 'chapter')]/@href",
    page_list: ["/updates"],
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
}

test("buildSettingsChangeSummary reports user-facing labels for changed fields", () => {
  const baseline = configToForm(makeConfig());
  const current = {
    ...baseline,
    base_dir: "E:/library",
    retry_count: 5,
    post_process_enabled: true,
  };

  assert.deepEqual(buildSettingsChangeSummary(current, baseline), [
    { key: "base_dir", label: "下载目录" },
    { key: "retry_count", label: "重试次数" },
    { key: "post_process_enabled", label: "后处理脚本" },
  ]);
});

test("buildSettingsChangeSummary limits long change lists", () => {
  const baseline = configToForm(makeConfig());
  const current = {
    ...baseline,
    base_dir: "E:/library",
    temp_dir: "E:/tmp",
    log_dir: "E:/logs",
  };

  assert.equal(buildSettingsChangeSummary(current, baseline, 2).length, 2);
});

test("parseImportedConfig accepts config objects compatible with settings schema", () => {
  const config = makeConfig();

  assert.deepEqual(parseImportedConfig(config), config);
});

test("parseImportedConfig rejects malformed config imports", () => {
  const config = makeConfig({
    network: {
      ...makeConfig().network,
      timeout: 999,
    },
  });

  assert.throws(() => parseImportedConfig(config), /Too big|小于或等于|maximum/i);
});

test("parseImportedConfig rejects imports missing core sections", () => {
  const missingWebsites = { ...makeConfig() } as Record<string, unknown>;
  delete missingWebsites.websites;

  const missingBlacklist = { ...makeConfig() } as Record<string, unknown>;
  delete missingBlacklist.blacklist;

  assert.throws(() => parseImportedConfig(missingWebsites), /websites/i);
  assert.throws(() => parseImportedConfig(missingBlacklist), /blacklist/i);
});

test("parseImportedConfig rejects imports with incomplete nested sections", () => {
  const missingContentRuleList = makeConfig({
    content_filter: {
      ad_patterns: [],
      nav_keywords: [],
      safety_threshold: 0.3,
    } as AppConfig["content_filter"],
  });
  const invalidWebsite = makeConfig({
    websites: {
      broken: {
        ...makeWebsite(),
        page_list: undefined,
      } as unknown as AppConfig["websites"][string],
    },
  });

  assert.throws(() => parseImportedConfig(missingContentRuleList), /fallback_trim_lines/i);
  assert.throws(() => parseImportedConfig(invalidWebsite), /page_list/i);
});

test("parseImportedConfig rejects invalid blacklist and content regex rules", () => {
  const invalidBlacklistRegex = makeConfig({
    blacklist: {
      ...makeConfig().blacklist,
      regex_patterns: ["["],
    },
  });
  const invalidContentRegex = makeConfig({
    content_filter: {
      ...makeConfig().content_filter,
      ad_patterns: ["有效.*", "["],
    },
  });

  assert.throws(() => parseImportedConfig(invalidBlacklistRegex), /正则表达式无效/i);
  assert.throws(() => parseImportedConfig(invalidContentRegex), /正则表达式无效/i);
});

test("settingsSchema rejects invalid content cleanup regex from form edits", () => {
  const form = {
    ...configToForm(makeConfig()),
    ad_patterns: "有效.*\n[",
  };

  assert.throws(() => settingsSchema.parse(form), /广告规则中包含无效正则/i);
});

test("parseImportedConfig accepts complete website and filter sections", () => {
  const config = makeConfig({
    websites: {
      example: makeWebsite(),
    },
  });

  assert.deepEqual(parseImportedConfig(config).websites.example?.domain_name, "https://example.com");
});

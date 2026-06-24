import assert from "node:assert/strict";
import test from "node:test";

import type { BlacklistConfig, ContentFilterConfig } from "../../types/index.ts";

import {
  buildBlacklistImportPlan,
  buildFilterSaveState,
  buildContentFilterImportPlan,
  buildImportSummary,
  buildStringListImportPlan,
  filterStringListByQuery,
  mergeFilterConfigDrafts,
  mergeUniqueStrings,
  parseRegexLineDraft,
  parseUniqueLineDraft,
  runBlacklistTest,
  runContentFilterPreview,
  serializeFilterDraft,
} from "./filterPageUtils.ts";

test("mergeUniqueStrings preserves order and removes duplicates", () => {
  assert.deepEqual(mergeUniqueStrings(["已有", "保留"], ["新增", "已有", "新增"]), [
    "已有",
    "保留",
    "新增",
  ]);
});

test("parseUniqueLineDraft accepts new values while counting duplicates and empty items", () => {
  assert.deepEqual(parseUniqueLineDraft("  新增\n已有\n\n新增,更多  ", ["已有"]), {
    accepted: ["新增", "更多"],
    duplicateCount: 2,
    emptyCount: 0,
  });
});

test("filterStringListByQuery filters case-insensitively without mutating empty searches", () => {
  const items = ["AdBlock", "正文保留", "footer-nav"];

  assert.equal(filterStringListByQuery(items, ""), items);
  assert.deepEqual(filterStringListByQuery(items, "AD"), ["AdBlock"]);
  assert.deepEqual(filterStringListByQuery(items, "nav"), ["footer-nav"]);
});

test("parseRegexLineDraft reports invalid regex entries separately", () => {
  assert.deepEqual(parseRegexLineDraft("新增.*\n[\n已有", ["已有"], (value) => {
    try {
      new RegExp(value);
      return true;
    } catch {
      return false;
    }
  }), {
    accepted: ["新增.*"],
    duplicateCount: 1,
    emptyCount: 0,
    invalidCount: 1,
  });
});

test("buildImportSummary reports accepted and skipped entries", () => {
  assert.equal(buildImportSummary(3, 1, 2, "规则"), "已导入 3 条规则，跳过 1 条重复项，忽略 2 条空白项");
  assert.equal(
    buildImportSummary(1, 0, 0, "规则", 2),
    "已导入 1 条规则，跳过 2 条无效项",
  );
  assert.equal(buildImportSummary(0, 0, 0, "规则"), null);
});

test("buildStringListImportPlan trims arrays and skips duplicates, blanks, and invalid values", () => {
  const plan = buildStringListImportPlan(
    [" 新值 ", "已有", "", "[", "新值"],
    ["已有"],
    (value) => value !== "[",
  );

  assert.deepEqual(plan, {
    accepted: ["新值"],
    duplicateCount: 2,
    emptyCount: 1,
    invalidCount: 1,
  });
});

test("buildBlacklistImportPlan validates regex and includes whitelist and tags", () => {
  const blacklist: BlacklistConfig = {
    enabled: true,
    filter_level: "moderate",
    case_insensitive: true,
    fuzzy_match: true,
    regex_match: true,
    tag_filter: true,
    filtered_tags: ["旧标签"],
    keywords: ["旧词"],
    regex_patterns: ["旧.*"],
    grading_rules: {
      strict: [],
      moderate: [],
      mild: [],
    },
    whitelist: ["旧白名单"],
  };

  const plan = buildBlacklistImportPlan(
    {
      keywords: ["新词", "旧词"],
      regex_patterns: ["新.*", "[", "旧.*"],
      whitelist: ["新白名单", ""],
      filtered_tags: ["新标签", "旧标签"],
    },
    blacklist,
    (value) => {
      try {
        new RegExp(value);
        return true;
      } catch {
        return false;
      }
    },
  );

  assert.deepEqual(plan.keywords.accepted, ["新词"]);
  assert.deepEqual(plan.regexPatterns.accepted, ["新.*"]);
  assert.equal(plan.regexPatterns.invalidCount, 1);
  assert.equal(plan.regexPatterns.duplicateCount, 1);
  assert.deepEqual(plan.whitelist.accepted, ["新白名单"]);
  assert.equal(plan.whitelist.emptyCount, 1);
  assert.deepEqual(plan.filteredTags.accepted, ["新标签"]);
});

test("buildContentFilterImportPlan rejects invalid ad regex without dropping nav keywords", () => {
  const config: ContentFilterConfig = {
    ad_patterns: ["旧广告"],
    nav_keywords: ["上一章"],
    safety_threshold: 0.75,
    fallback_trim_lines: 2,
  };

  const plan = buildContentFilterImportPlan(
    {
      ad_patterns: ["新广告.*", "[", "旧广告"],
      nav_keywords: ["下一章", "上一章", null],
    },
    config,
    (value) => {
      try {
        new RegExp(value);
        return true;
      } catch {
        return false;
      }
    },
  );

  assert.deepEqual(plan.adPatterns.accepted, ["新广告.*"]);
  assert.equal(plan.adPatterns.invalidCount, 1);
  assert.equal(plan.adPatterns.duplicateCount, 1);
  assert.deepEqual(plan.navKeywords.accepted, ["下一章"]);
  assert.equal(plan.navKeywords.duplicateCount, 1);
  assert.equal(plan.navKeywords.invalidCount, 1);
});

test("buildFilterSaveState marks current draft as dirty before save", () => {
  const saved = serializeFilterDraft({ keywords: ["广告"] });
  const current = serializeFilterDraft({ keywords: ["广告", "推广"] });

  assert.deepEqual(buildFilterSaveState({ savedSnapshot: saved, currentSnapshot: current }), {
    dirty: true,
    tone: "warning",
    label: "有未保存更改",
    hint: "请保存后再离开或继续测试导出。",
  });
});

test("buildFilterSaveState reports saving and saved moments", () => {
  const snapshot = serializeFilterDraft({ ad_patterns: ["foo"] });
  const savedAt = "2026-06-21 12:30";

  assert.deepEqual(
    buildFilterSaveState({ savedSnapshot: snapshot, currentSnapshot: snapshot, saving: true }),
    {
      dirty: false,
      tone: "neutral",
      label: "保存中...",
      hint: "正在写入当前过滤配置。",
    },
  );

  assert.deepEqual(
    buildFilterSaveState({ savedSnapshot: snapshot, currentSnapshot: snapshot, lastSavedAt: savedAt }),
    {
      dirty: false,
      tone: "success",
      label: "已保存",
      hint: `最近一次保存于 ${savedAt}`,
    },
  );
});

test("mergeFilterConfigDrafts preserves sibling draft changes across tabs", () => {
  const config = {
    blacklist: {
      enabled: true,
      filter_level: "moderate",
      case_insensitive: true,
      fuzzy_match: true,
      regex_match: true,
      tag_filter: false,
      filtered_tags: [],
      keywords: ["旧关键词"],
      regex_patterns: [],
      grading_rules: {
        strict: [],
        moderate: [],
        mild: [],
      },
      whitelist: [],
    },
    content_filter: {
      ad_patterns: ["旧广告"],
      nav_keywords: ["上一章"],
      safety_threshold: 0.6,
      fallback_trim_lines: 2,
    },
  } as const;

  const merged = mergeFilterConfigDrafts(config as never, {
    blacklist: {
      ...config.blacklist,
      keywords: ["新关键词"],
    },
    content_filter: {
      ...config.content_filter,
      ad_patterns: ["新广告"],
    },
  });

  assert.deepEqual(merged.blacklist.keywords, ["新关键词"]);
  assert.deepEqual(merged.content_filter.ad_patterns, ["新广告"]);
  assert.deepEqual(merged.content_filter.nav_keywords, ["上一章"]);
});

test("runBlacklistTest respects whitelist before keyword match", () => {
  const blacklist: BlacklistConfig = {
    enabled: true,
    filter_level: "moderate",
    case_insensitive: true,
    fuzzy_match: true,
    regex_match: true,
    tag_filter: false,
    filtered_tags: [],
    keywords: ["广告"],
    regex_patterns: ["推广"],
    grading_rules: {
      strict: [],
      moderate: [],
      mild: [],
    },
    whitelist: ["广告豁免作品"],
  };

  assert.deepEqual(runBlacklistTest("广告豁免作品", blacklist), {
    blocked: false,
    matchedBy: "whitelist",
  });
});

test("runContentFilterPreview rolls back removals when safety threshold is exceeded", () => {
  const config: ContentFilterConfig = {
    ad_patterns: ["广告"],
    nav_keywords: ["上一章"],
    safety_threshold: 0.75,
    fallback_trim_lines: 2,
  };

  const result = runContentFilterPreview("广告位\n广告词\n上一章\n正文保留", config);

  assert.equal(result.safetyRollback, true);
  assert.equal(result.removedCount, 0);
  assert.equal(result.keptCount, 4);
  assert.equal(result.lines.every((line) => line.removed === false), true);
});

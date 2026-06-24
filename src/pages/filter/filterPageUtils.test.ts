import assert from "node:assert/strict";
import test from "node:test";

import type { BlacklistConfig, ContentFilterConfig } from "../../types/index.ts";

import {
  buildFilterSaveState,
  buildImportSummary,
  mergeFilterConfigDrafts,
  mergeUniqueStrings,
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

test("buildImportSummary reports accepted and skipped entries", () => {
  assert.equal(buildImportSummary(3, 1, 2, "规则"), "已导入 3 条规则，跳过 1 条重复项，忽略 2 条空白项");
  assert.equal(buildImportSummary(0, 0, 0, "规则"), null);
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

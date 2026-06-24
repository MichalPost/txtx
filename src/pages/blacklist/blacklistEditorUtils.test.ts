import assert from "node:assert/strict";
import test from "node:test";

import type { BlacklistConfig } from "../../types/index.ts";

import {
  buildBlacklistSummary,
  buildDraftListFeedback,
  formatDraftFeedback,
  isValidRegexPattern,
  serializeBlacklistDraft,
  splitDraftValues,
} from "./blacklistEditorUtils.ts";

test("splitDraftValues splits on line breaks and punctuation", () => {
  assert.deepEqual(splitDraftValues(" foo\nbar，baz、qux "), ["foo", "bar", "baz", "qux"]);
});

test("buildDraftListFeedback reports accepted, duplicate, empty, and invalid values", () => {
  const result = buildDraftListFeedback([" 已有 ", "", "新增", "新增", "["], ["已有"], (value) =>
    value !== "[",
  );

  assert.deepEqual(result.accepted, ["新增"]);
  assert.deepEqual(result.duplicateValues, ["已有", "新增"]);
  assert.equal(result.emptyCount, 1);
  assert.deepEqual(result.invalidEntries, ["["]);
});

test("isValidRegexPattern validates regex syntax", () => {
  assert.equal(isValidRegexPattern("^foo.*$"), true);
  assert.equal(isValidRegexPattern("["), false);
});

test("serializeBlacklistDraft changes when blacklist content changes", () => {
  const blacklist: BlacklistConfig = {
    enabled: true,
    filter_level: "moderate",
    case_insensitive: true,
    fuzzy_match: true,
    regex_match: false,
    tag_filter: false,
    filtered_tags: [],
    keywords: ["广告"],
    regex_patterns: [],
    grading_rules: {
      strict: [],
      moderate: [],
      mild: [],
    },
  };

  const first = serializeBlacklistDraft(blacklist);
  const second = serializeBlacklistDraft({ ...blacklist, keywords: [...blacklist.keywords, "推广"] });

  assert.notEqual(first, second);
});

test("buildBlacklistSummary aggregates current blacklist state", () => {
  const summary = buildBlacklistSummary({
    enabled: true,
    filter_level: "strict",
    case_insensitive: true,
    fuzzy_match: false,
    regex_match: true,
    tag_filter: true,
    filtered_tags: ["完本", "无删减"],
    keywords: ["广告", "推广"],
    regex_patterns: ["^测试$"],
    grading_rules: {
      strict: [],
      moderate: [],
      mild: [],
    },
  });

  assert.deepEqual(summary, {
    keywordCount: 2,
    regexCount: 1,
    tagCount: 2,
    enabledFeatureCount: 4,
  });
});

test("formatDraftFeedback returns a compact summary", () => {
  assert.equal(formatDraftFeedback(2, 1, 0, 1), "新增 2 条，跳过 1 条重复项，拦截 1 条无效项");
  assert.equal(formatDraftFeedback(0, 0, 0, 0), null);
});

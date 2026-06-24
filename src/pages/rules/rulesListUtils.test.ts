import assert from "node:assert/strict";
import test from "node:test";

import type { WebsiteConfig } from "@/types";

import {
  buildRulesSummary,
  buildVisibleRuleWindow,
  filterAndSortRules,
  type RulesListQuery,
} from "./rulesListUtils.ts";

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
    page_list: overrides.page_list ?? ["/tongren"],
    special_mode: overrides.special_mode ?? "normal",
    novel_content_fallbacks: overrides.novel_content_fallbacks ?? [],
    encoding: overrides.encoding ?? "",
    site_ad_rules: overrides.site_ad_rules ?? {
      enabled: true,
      xpath_rules: [],
      regex_rules: [],
      nav_keywords: [],
      trim_head: 0,
      trim_tail: 0,
    },
  };
}

function makeQuery(overrides: Partial<RulesListQuery> = {}): RulesListQuery {
  return {
    search: overrides.search ?? "",
    status: overrides.status ?? "all",
    sort: overrides.sort ?? "name_asc",
    sitePriority: overrides.sitePriority,
  };
}

test("filterAndSortRules filters by keyword and status", () => {
  const sites = {
    alpha: makeSite({
      domain_name: "https://alpha.com",
      list_novel_name: "//a",
      release_url: "/list",
      novel_content: "//content",
      enabled: true,
    }),
    beta: makeSite({
      domain_name: "https://beta.com",
      enabled: false,
    }),
    gamma: makeSite({
      domain_name: "https://novel-gamma.com",
      list_novel_name: "//a",
      release_url: "/list",
      novel_content: "//content",
      enabled: true,
    }),
  };

  const result = filterAndSortRules(sites, makeQuery({ search: "gamma", status: "enabled" }));

  assert.deepEqual(result, ["gamma"]);
});

test("filterAndSortRules can focus on incomplete rules", () => {
  const sites = {
    done: makeSite({
      domain_name: "https://done.com",
      list_novel_name: "//a",
      release_url: "/list",
      novel_content: "//content",
    }),
    todo: makeSite({
      domain_name: "https://todo.com",
      list_novel_name: "",
      release_url: "",
      novel_content: "",
    }),
  };

  const result = filterAndSortRules(sites, makeQuery({ status: "incomplete" }));

  assert.deepEqual(result, ["todo"]);
});

test("filterAndSortRules respects saved site priority before fallback sorting", () => {
  const sites = {
    alpha: makeSite({
      domain_name: "https://alpha.com",
      enabled: true,
    }),
    beta: makeSite({
      domain_name: "https://beta.com",
      enabled: true,
    }),
    gamma: makeSite({
      domain_name: "https://gamma.com",
      enabled: true,
    }),
  };

  const result = filterAndSortRules(
    sites,
    makeQuery({
      sort: "enabled_first",
      sitePriority: {
        "https://gamma.com": 1,
        "https://alpha.com": 2,
        "https://beta.com": 3,
      },
    }),
  );

  assert.deepEqual(result, ["gamma", "alpha", "beta"]);
});

test("buildRulesSummary aggregates counts", () => {
  const sites = {
    a: makeSite({
      domain_name: "https://a.com",
      enabled: true,
      list_novel_name: "//a",
      release_url: "/list",
      novel_content: "//content",
    }),
    b: makeSite({
      domain_name: "https://b.com",
      enabled: false,
    }),
    c: makeSite({
      domain_name: "https://c.com",
      enabled: true,
    }),
  };

  assert.deepEqual(buildRulesSummary(sites), {
    total: 3,
    enabled: 2,
    complete: 1,
    incomplete: 2,
  });
});

test("buildVisibleRuleWindow returns the current page of visible rule keys", () => {
  const result = buildVisibleRuleWindow(["a", "b", "c", "d", "e"], 2, 2);

  assert.deepEqual(result, {
    visibleKeys: ["a", "b"],
    visibleCount: 2,
    totalCount: 5,
    hasMore: true,
    nextVisibleCount: 4,
  });
});

test("buildVisibleRuleWindow clamps counts and handles invalid batch sizes", () => {
  const result = buildVisibleRuleWindow(["a", "b", "c"], 99, 0);

  assert.deepEqual(result, {
    visibleKeys: ["a", "b", "c"],
    visibleCount: 3,
    totalCount: 3,
    hasMore: false,
    nextVisibleCount: 3,
  });
});

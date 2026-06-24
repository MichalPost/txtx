import assert from "node:assert/strict";
import test from "node:test";

import type { SiteHealth } from "@/types";

import {
  buildHealthReport,
  buildHealthSummary,
  deriveHealthViewState,
  filterAndSortSiteHealth,
} from "./healthPageUtils.ts";

const sampleResults: SiteHealth[] = [
  {
    domain: "https://alpha.example.com",
    reachable: true,
    latency_ms: 120,
    error: null,
  },
  {
    domain: "https://bravo.example.com",
    reachable: false,
    latency_ms: null,
    error: "timeout",
  },
  {
    domain: "https://charlie.example.com",
    reachable: true,
    latency_ms: 340,
    error: null,
  },
];

test("buildHealthSummary computes counts and latency stats", () => {
  assert.deepEqual(buildHealthSummary(sampleResults), {
    total: 3,
    reachable: 2,
    unreachable: 1,
    averageLatency: 230,
    fastestSite: "alpha.example.com",
    fastestLatency: 120,
  });
});

test("filterAndSortSiteHealth applies search, status filter and latency sort", () => {
  const result = filterAndSortSiteHealth(sampleResults, {
    query: "example",
    status: "reachable",
    sort: "latency-asc",
  });

  assert.deepEqual(
    result.map((item) => item.domain),
    ["https://alpha.example.com", "https://charlie.example.com"],
  );
});

test("filterAndSortSiteHealth can surface failures first", () => {
  const result = filterAndSortSiteHealth(sampleResults, {
    query: "",
    status: "all",
    sort: "status",
  });

  assert.equal(result[0]?.domain, "https://bravo.example.com");
});

test("deriveHealthViewState distinguishes initial, checking, empty and no-match states", () => {
  assert.equal(
    deriveHealthViewState({
      hasChecked: false,
      checking: false,
      totalResults: 0,
      visibleResults: 0,
    }),
    "idle",
  );

  assert.equal(
    deriveHealthViewState({
      hasChecked: false,
      checking: true,
      totalResults: 0,
      visibleResults: 0,
    }),
    "checking",
  );

  assert.equal(
    deriveHealthViewState({
      hasChecked: true,
      checking: false,
      totalResults: 0,
      visibleResults: 0,
    }),
    "empty",
  );

  assert.equal(
    deriveHealthViewState({
      hasChecked: true,
      checking: false,
      totalResults: 3,
      visibleResults: 0,
    }),
    "no-match",
  );
});

test("buildHealthReport exports summary and sorted site details", () => {
  const report = buildHealthReport({
    results: sampleResults,
    checkedAt: new Date("2026-06-24T10:00:00+08:00"),
  });

  assert.match(report, /站点总数：3/);
  assert.match(report, /可达站点：2/);
  assert.match(report, /不可达站点：1/);
  assert.match(report, /bravo\.example\.com：不可达；延迟：暂无；错误：timeout/);
  assert.match(report, /alpha\.example\.com：可达；延迟：120 ms/);
});

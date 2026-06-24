import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPreflightDecision,
  buildPreflightScope,
  canContinueWithPreflight,
  summarizePreflightResults,
} from "./preflightDecision.ts";

test("canContinueWithPreflight blocks continuation when a fetch error occurred", () => {
  assert.equal(
    canContinueWithPreflight({
      done: true,
      error: "network failed",
    }),
    false,
  );
});

test("buildPreflightScope prefers selected sites and falls back to all enabled sites", () => {
  assert.deepEqual(buildPreflightScope(["a.example"], ["b.example"]), ["a.example"]);
  assert.deepEqual(buildPreflightScope([], ["b.example", "a.example"]), ["a.example", "b.example"]);
});

test("summarizePreflightResults focuses on selected scope and reports unhealthy sites", () => {
  const summary = summarizePreflightResults(
    [
      { domain: "a.example", reachable: true, latency_ms: 120, error: null },
      { domain: "b.example", reachable: false, latency_ms: null, error: "timeout" },
      { domain: "c.example", reachable: false, latency_ms: null, error: "dns" },
    ],
    ["a.example", "b.example"],
  );

  assert.equal(summary.total, 2);
  assert.equal(summary.successCount, 1);
  assert.equal(summary.failCount, 1);
  assert.deepEqual(summary.failingDomains, ["b.example"]);
});

test("canContinueWithPreflight allows continuation when check completed without error", () => {
  assert.equal(
    canContinueWithPreflight({
      done: true,
      error: "",
    }),
    true,
  );
});

test("canContinueWithPreflight blocks while check is still running", () => {
  assert.equal(
    canContinueWithPreflight({
      done: false,
      error: "",
    }),
    false,
  );
});

test("buildPreflightDecision explains the pending and error states", () => {
  assert.deepEqual(
    buildPreflightDecision({
      done: false,
      error: "",
      scopedSites: ["a.example", "b.example"],
      summary: { results: [], total: 0, successCount: 0, failCount: 0, failingDomains: [] },
    }),
    {
      canContinue: false,
      ctaLabel: "先检测站点",
      description: "将检测 2 个目标站点的可达性，避免直接创建大批失败任务。",
      retryLabel: "开始检测",
      title: "等待预检",
      tone: "neutral",
    },
  );

  assert.equal(
    buildPreflightDecision({
      done: true,
      error: "network",
      scopedSites: ["a.example"],
      summary: { results: [], total: 0, successCount: 0, failCount: 0, failingDomains: [] },
    }).tone,
    "danger",
  );
});

test("buildPreflightDecision distinguishes partial failure and successful checks", () => {
  const warning = buildPreflightDecision({
    done: true,
    error: "",
    scopedSites: ["a.example", "b.example"],
    summary: {
      results: [],
      total: 2,
      successCount: 1,
      failCount: 1,
      failingDomains: ["b.example"],
    },
  });

  assert.equal(warning.canContinue, true);
  assert.equal(warning.tone, "warning");
  assert.equal(warning.ctaLabel, "忽略异常并创建");
  assert.match(warning.description, /b\.example/);

  const success = buildPreflightDecision({
    done: true,
    error: "",
    scopedSites: ["a.example"],
    summary: {
      results: [],
      total: 1,
      successCount: 1,
      failCount: 0,
      failingDomains: [],
    },
  });

  assert.equal(success.tone, "success");
  assert.equal(success.ctaLabel, "创建扫描任务");
});

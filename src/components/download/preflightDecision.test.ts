import test from "node:test";
import assert from "node:assert/strict";

import {
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

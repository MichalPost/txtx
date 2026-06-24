import assert from "node:assert/strict";
import test from "node:test";

import type { AiProviderEntry } from "@/store/aiStore";

import {
  buildProviderSnapshot,
  getProviderDraftSyncState,
  isProviderDraftDirty,
  parseProviderPositiveIntegerDraft,
  parseProviderTemperatureDraft,
} from "./providerCardUtils.ts";

function makeProvider(overrides: Partial<AiProviderEntry> = {}): AiProviderEntry {
  return {
    name: overrides.name ?? "deepseek",
    base_url: overrides.base_url ?? "https://api.deepseek.com/v1",
    api_key: overrides.api_key ?? "",
    model: overrides.model ?? "deepseek-chat",
    available_models: overrides.available_models ?? ["deepseek-chat"],
    max_tokens: overrides.max_tokens ?? 2048,
    temperature: overrides.temperature ?? 0.2,
  };
}

test("buildProviderSnapshot changes when editable provider fields change", () => {
  const before = makeProvider();
  const after = makeProvider({ model: "deepseek-reasoner" });

  assert.notEqual(buildProviderSnapshot(before), buildProviderSnapshot(after));
});

test("isProviderDraftDirty compares the draft against its baseline", () => {
  const baseline = makeProvider();

  assert.equal(isProviderDraftDirty(makeProvider(), baseline), false);
  assert.equal(isProviderDraftDirty(makeProvider({ temperature: 0.7 }), baseline), true);
});

test("getProviderDraftSyncState distinguishes local edits from external changes", () => {
  const baseline = makeProvider();

  assert.equal(
    getProviderDraftSyncState({
      form: makeProvider(),
      baseline,
      entry: makeProvider({ model: "deepseek-reasoner" }),
    }),
    "synced",
  );
  assert.equal(
    getProviderDraftSyncState({
      form: makeProvider({ api_key: "sk-local" }),
      baseline,
      entry: makeProvider(),
    }),
    "dirty",
  );
  assert.equal(
    getProviderDraftSyncState({
      form: makeProvider({ api_key: "sk-local" }),
      baseline,
      entry: makeProvider({ model: "deepseek-reasoner" }),
    }),
    "stale",
  );
});

test("parseProviderPositiveIntegerDraft preserves zero and falls back for invalid values", () => {
  assert.equal(parseProviderPositiveIntegerDraft("0", 2048), 0);
  assert.equal(parseProviderPositiveIntegerDraft("4096", 2048), 4096);
  assert.equal(parseProviderPositiveIntegerDraft("", 2048), 2048);
  assert.equal(parseProviderPositiveIntegerDraft("-1", 2048), 0);
});

test("parseProviderTemperatureDraft preserves zero, falls back, and clamps out-of-range values", () => {
  assert.equal(parseProviderTemperatureDraft("0", 0.2), 0);
  assert.equal(parseProviderTemperatureDraft("1.5", 0.2), 1.5);
  assert.equal(parseProviderTemperatureDraft("", 0.2), 0.2);
  assert.equal(parseProviderTemperatureDraft("2.5", 0.2), 2);
});

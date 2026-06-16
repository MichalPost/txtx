import assert from "node:assert/strict";
import test from "node:test";

import { formatToolActionError } from "./toolActionError.ts";

async function resolveRefreshError<T>(refetch: () => Promise<{ error: T | null }>) {
  const result = await refetch();
  return result.error ? formatToolActionError("刷新历史", result.error) : null;
}

test("resolveRefreshError returns null when refetch succeeds", async () => {
  const message = await resolveRefreshError(async () => ({ error: null }));
  assert.equal(message, null);
});

test("resolveRefreshError formats refresh errors", async () => {
  const message = await resolveRefreshError(async () => ({ error: new Error("backend unavailable") }));
  assert.equal(message, "刷新历史失败：backend unavailable");
});

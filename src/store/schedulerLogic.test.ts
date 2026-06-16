import test from "node:test";
import assert from "node:assert/strict";

import { formatLocalDateKey, shouldRunScheduledTask } from "./schedulerLogic.ts";

test("formatLocalDateKey uses local calendar date instead of UTC date", () => {
  const date = new Date("2026-06-16T00:30:00+08:00");

  assert.equal(formatLocalDateKey(date), "2026-06-16");
});

test("shouldRunScheduledTask runs once when local hour matches and task has not run today", () => {
  const now = new Date("2026-06-16T06:15:00+08:00");

  assert.equal(
    shouldRunScheduledTask({
      now,
      targetHour: 6,
      lastRun: "2026-06-15",
    }),
    true,
  );
});

test("shouldRunScheduledTask does not rerun after local date has already been marked", () => {
  const now = new Date("2026-06-16T06:45:00+08:00");

  assert.equal(
    shouldRunScheduledTask({
      now,
      targetHour: 6,
      lastRun: "2026-06-16",
    }),
    false,
  );
});

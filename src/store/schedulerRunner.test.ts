import test from "node:test";
import assert from "node:assert/strict";

import { runScheduledBatchTask } from "./schedulerRunner.ts";

test("runScheduledBatchTask marks the run only after task creation succeeds", async () => {
  let marked = 0;
  let errors = 0;

  await runScheduledBatchTask({
    now: new Date("2026-06-16T06:00:00+08:00"),
    targetHour: 6,
    lastRun: "2026-06-15",
    createTask: async () => {},
    markRan: () => {
      marked += 1;
    },
    onError: () => {
      errors += 1;
    },
  });

  assert.equal(marked, 1);
  assert.equal(errors, 0);
});

test("runScheduledBatchTask reports failures without marking the run", async () => {
  let marked = 0;
  const errors: string[] = [];

  await runScheduledBatchTask({
    now: new Date("2026-06-16T06:00:00+08:00"),
    targetHour: 6,
    lastRun: "2026-06-15",
    createTask: async () => {
      throw new Error("scheduler failed");
    },
    markRan: () => {
      marked += 1;
    },
    onError: (error) => {
      errors.push(String(error));
    },
  });

  assert.equal(marked, 0);
  assert.deepEqual(errors, ["Error: scheduler failed"]);
});

test("runScheduledBatchTask skips creation when the schedule should not run", async () => {
  let invoked = 0;

  await runScheduledBatchTask({
    now: new Date("2026-06-16T05:00:00+08:00"),
    targetHour: 6,
    lastRun: "2026-06-15",
    createTask: async () => {
      invoked += 1;
    },
    markRan: () => {
      invoked += 100;
    },
    onError: () => {
      invoked += 1000;
    },
  });

  assert.equal(invoked, 0);
});

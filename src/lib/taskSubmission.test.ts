import test from "node:test";
import assert from "node:assert/strict";

import { createTasksFromUrls, submitTaskAndThen } from "./taskSubmission.ts";

test("submitTaskAndThen only runs side effects after task creation succeeds", async () => {
  let afterSubmitCalls = 0;

  await submitTaskAndThen(
    async () => {},
    () => {
      afterSubmitCalls += 1;
    },
  );

  assert.equal(afterSubmitCalls, 1);

  await assert.rejects(
    () =>
      submitTaskAndThen(
        async () => {
          throw new Error("create failed");
        },
        () => {
          afterSubmitCalls += 1;
        },
      ),
    /create failed/,
  );

  assert.equal(afterSubmitCalls, 1);
});

test("submitTaskAndThen collapses repeated in-flight submissions", async () => {
  let createCalls = 0;
  let afterSubmitCalls = 0;
  let release: (() => void) | null = null;

  const first = submitTaskAndThen(
    async () => {
      createCalls += 1;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    () => {
      afterSubmitCalls += 1;
    },
  );

  const second = submitTaskAndThen(
    async () => {
      createCalls += 1;
    },
    () => {
      afterSubmitCalls += 1;
    },
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(createCalls, 1);
  assert.equal(afterSubmitCalls, 0);

  release?.();
  await Promise.all([first, second]);

  assert.equal(createCalls, 1);
  assert.equal(afterSubmitCalls, 1);
});

test("createTasksFromUrls reports per-url failures without stopping later tasks", async () => {
  const created: string[] = [];

  const result = await createTasksFromUrls(
    ["https://a.example", "https://b.example", "https://c.example"],
    async (url) => {
      if (url === "https://b.example") {
        throw new Error("boom");
      }

      created.push(url);
    },
  );

  assert.deepEqual(created, ["https://a.example", "https://c.example"]);
  assert.equal(result.successCount, 2);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0]?.url, "https://b.example");
  assert.match(result.failures[0]?.message ?? "", /boom/);
});

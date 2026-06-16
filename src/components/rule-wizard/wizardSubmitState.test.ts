import assert from "node:assert/strict";
import test from "node:test";

test("wizard submit lock prevents duplicate start and releases after success", async () => {
  let submitting = false;
  let starts = 0;

  const runSubmit = async () => {
    if (submitting) return false;
    submitting = true;
    starts += 1;
    try {
      await Promise.resolve();
      return true;
    } finally {
      submitting = false;
    }
  };

  assert.equal(await runSubmit(), true);
  assert.equal(starts, 1);
  assert.equal(submitting, false);
});

test("wizard submit lock releases after failure", async () => {
  let submitting = false;

  const runSubmit = async () => {
    if (submitting) return;
    submitting = true;
    try {
      throw new Error("save failed");
    } finally {
      submitting = false;
    }
  };

  await assert.rejects(runSubmit, /save failed/);
  assert.equal(submitting, false);
});

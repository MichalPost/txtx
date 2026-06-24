import assert from "node:assert/strict";
import test from "node:test";

import { createConfirmController, normalizeConfirmRequest } from "./confirmDialogController.ts";

test("normalizeConfirmRequest fills default labels and tone", () => {
  const pending = normalizeConfirmRequest({ title: "Delete item" }, () => {});

  assert.equal(pending.title, "Delete item");
  assert.equal(pending.confirmLabel, "确认");
  assert.equal(pending.cancelLabel, "取消");
  assert.equal(pending.tone, "default");
});

test("confirm publishes pending request and resolves true on close", async () => {
  const pendingChanges: Array<string | null> = [];
  const controller = createConfirmController<string>((pending) => {
    assert.equal("resolve" in (pending ?? {}), false);
    pendingChanges.push(pending?.title ?? null);
  });

  const result = controller.confirm({
    title: "Import overwrite",
    description: "Replace existing rules",
    confirmLabel: "Overwrite",
    tone: "warning",
  });

  assert.equal(controller.getPending()?.title, "Import overwrite");
  assert.deepEqual(pendingChanges, ["Import overwrite"]);

  controller.close(true);

  assert.equal(await result, true);
  assert.equal(controller.getPending(), null);
  assert.deepEqual(pendingChanges, ["Import overwrite", null]);
});

test("starting a new confirm cancels the previous pending promise", async () => {
  const pendingChanges: Array<string | null> = [];
  const controller = createConfirmController((pending) => {
    pendingChanges.push(pending?.title ?? null);
  });

  const first = controller.confirm({ title: "First" });
  const second = controller.confirm({ title: "Second" });

  assert.equal(await first, false);
  assert.equal(controller.getPending()?.title, "Second");
  assert.deepEqual(pendingChanges, ["First", "Second"]);

  controller.close(true);

  assert.equal(await second, true);
});

test("closing without pending is a no-op and dispose cancels pending work", async () => {
  const pendingChanges: Array<string | null> = [];
  const controller = createConfirmController((pending) => {
    pendingChanges.push(pending?.title ?? null);
  });

  controller.close(false);
  assert.deepEqual(pendingChanges, []);

  const result = controller.confirm({ title: "Unsaved changes" });
  controller.dispose();

  assert.equal(await result, false);
  assert.equal(controller.getPending(), null);
  assert.deepEqual(pendingChanges, ["Unsaved changes", null]);
});

test("closing repeatedly only resolves the active confirmation once", async () => {
  const controller = createConfirmController(() => {});
  const result = controller.confirm({ title: "Delete" });

  controller.close(true);
  controller.close(false);

  assert.equal(await result, true);
});

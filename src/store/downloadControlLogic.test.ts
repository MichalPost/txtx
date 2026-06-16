import assert from "node:assert/strict";
import test from "node:test";

import {
  getDownloadRunState,
  pauseDownloadAndUpdateState,
  stopDownloadAndUpdateState,
} from "./downloadControlLogic.ts";

test("getDownloadRunState starts downloads in downloading status", () => {
  assert.deepEqual(getDownloadRunState(), {
    phase: "downloading",
    status: "downloading",
  });
});

test("stopDownloadAndUpdateState updates state only after stop succeeds", async () => {
  const effects: string[] = [];

  await stopDownloadAndUpdateState(
    async () => {
      effects.push("stop");
    },
    () => {
      effects.push("stopped");
    },
  );

  assert.deepEqual(effects, ["stop", "stopped"]);

  const failedEffects: string[] = [];
  await assert.rejects(
    () =>
      stopDownloadAndUpdateState(
        async () => {
          failedEffects.push("stop");
          throw new Error("stop failed");
        },
        () => {
          failedEffects.push("stopped");
        },
      ),
    /stop failed/,
  );

  assert.deepEqual(failedEffects, ["stop"]);
});

test("pauseDownloadAndUpdateState updates state only after stop succeeds", async () => {
  const effects: string[] = [];

  await pauseDownloadAndUpdateState(
    async () => {
      effects.push("stop");
    },
    async () => {
      effects.push("paused");
    },
  );

  assert.deepEqual(effects, ["stop", "paused"]);

  const failedEffects: string[] = [];
  await assert.rejects(
    () =>
      pauseDownloadAndUpdateState(
        async () => {
          failedEffects.push("stop");
          throw new Error("pause stop failed");
        },
        async () => {
          failedEffects.push("paused");
        },
      ),
    /pause stop failed/,
  );

  assert.deepEqual(failedEffects, ["stop"]);
});

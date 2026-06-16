import test from "node:test";
import assert from "node:assert/strict";

import { startDesktopTaskSession } from "./desktopTaskSession.ts";

test("startDesktopTaskSession reports listener setup failures", async () => {
  const errors: string[] = [];
  let invoked = false;

  startDesktopTaskSession(
    {
      listenDesktopEvent: async () => {
        throw new Error("listen failed");
      },
      invokeDesktopCommand: async () => {
        invoked = true;
      },
    },
    {
      command: "create_scan_task",
      args: { options: null },
      eventName: "task_event",
      onEvent: () => {},
      onError: (error) => {
        errors.push(String(error));
      },
    },
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(invoked, false);
  assert.deepEqual(errors, ["Error: listen failed"]);
});

test("startDesktopTaskSession removes listeners when the invoke step fails", async () => {
  const errors: string[] = [];
  let unlistened = false;

  startDesktopTaskSession(
    {
      listenDesktopEvent: async (_eventName, _handler) => () => {
        unlistened = true;
      },
      invokeDesktopCommand: async () => {
        throw new Error("invoke failed");
      },
    },
    {
      command: "create_scan_task",
      args: { options: null },
      eventName: "task_event",
      onEvent: () => {},
      onError: (error) => {
        errors.push(String(error));
      },
    },
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(unlistened, true);
  assert.deepEqual(errors, ["Error: invoke failed"]);
});

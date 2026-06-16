import test from "node:test";
import assert from "node:assert/strict";

import { resolveSaveTextFilePlan } from "./saveTextFileStrategy.ts";

test("resolveSaveTextFilePlan uses native save when desktop path is available", () => {
  const plan = resolveSaveTextFilePlan({
    isTauri: true,
    canReadLocalFiles: true,
    selectedPath: "C:/tmp/file.json",
  });

  assert.deepEqual(plan, {
    action: "write-local",
    path: "C:/tmp/file.json",
  });
});

test("resolveSaveTextFilePlan throws when desktop save path exists but filesystem is unavailable", () => {
  assert.throws(
    () =>
      resolveSaveTextFilePlan({
        isTauri: true,
        canReadLocalFiles: false,
        selectedPath: "C:/tmp/file.json",
      }),
    /桌面文件系统插件不可用/,
  );
});

test("resolveSaveTextFilePlan falls back to browser download only outside desktop mode", () => {
  const plan = resolveSaveTextFilePlan({
    isTauri: false,
    canReadLocalFiles: false,
    selectedPath: null,
  });

  assert.deepEqual(plan, {
    action: "browser-download",
  });
});

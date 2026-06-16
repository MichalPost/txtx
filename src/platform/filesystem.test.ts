import test from "node:test";
import assert from "node:assert/strict";

import { createFilesystemUnavailableError } from "./filesystemErrors.ts";

test("createFilesystemUnavailableError explains unsupported web access", () => {
  const error = createFilesystemUnavailableError("read", "web");

  assert.match(error.message, /当前运行环境不支持本地文件读取/);
});

test("createFilesystemUnavailableError explains missing desktop plugin separately", () => {
  const error = createFilesystemUnavailableError("write", "desktop");

  assert.match(error.message, /桌面文件系统插件不可用/);
});

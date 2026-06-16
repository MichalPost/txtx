import test from "node:test";
import assert from "node:assert/strict";

import {
  createTauriFilesystemLoader,
  resolveFilesystemModuleState,
} from "./filesystemLoader.ts";

test("resolveFilesystemModuleState skips loading outside desktop mode", async () => {
  const state = await resolveFilesystemModuleState({
    canReadLocalFiles: false,
    loadModule: async () => {
      throw new Error("should not load");
    },
  });

  assert.deepEqual(state, { kind: "unsupported-platform" });
});

test("resolveFilesystemModuleState reports missing plugin separately", async () => {
  const state = await resolveFilesystemModuleState({
    canReadLocalFiles: true,
    loadModule: async () => null,
  });

  assert.deepEqual(state, { kind: "plugin-unavailable" });
});

test("resolveFilesystemModuleState returns module when loader succeeds", async () => {
  const module = {
    readTextFile: async (_path: string) => "ok",
    writeTextFile: async (_path: string, _content: string) => {},
  };

  const state = await resolveFilesystemModuleState({
    canReadLocalFiles: true,
    loadModule: async () => module,
  });

  assert.deepEqual(state, { kind: "ready", module });
});

test("createTauriFilesystemLoader delegates to dynamic import function", async () => {
  let requested = "";
  const expectedModule = {
    readTextFile: async (_path: string) => "content",
    writeTextFile: async (_path: string, _content: string) => {},
  };

  const load = createTauriFilesystemLoader(async (moduleName) => {
    requested = moduleName;
    return expectedModule;
  });

  const loaded = await load();

  assert.equal(requested, "@tauri-apps/plugin-fs");
  assert.equal(loaded, expectedModule);
});

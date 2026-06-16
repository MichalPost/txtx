import test from "node:test";
import assert from "node:assert/strict";

import { getPlatformCapabilities, resolvePlatformKind } from "./runtime.ts";

test("resolvePlatformKind prefers desktop runtime when tauri mode is enabled", () => {
  const kind = resolvePlatformKind({
    tauriMode: "true",
    hasTauriInternals: false,
  });

  assert.equal(kind, "desktop");
});

test("resolvePlatformKind falls back to desktop when tauri internals exist", () => {
  const kind = resolvePlatformKind({
    tauriMode: undefined,
    hasTauriInternals: true,
  });

  assert.equal(kind, "desktop");
});

test("resolvePlatformKind returns web when no desktop markers exist", () => {
  const kind = resolvePlatformKind({
    tauriMode: undefined,
    hasTauriInternals: false,
  });

  assert.equal(kind, "web");
});

test("getPlatformCapabilities exposes filesystem support only on desktop", () => {
  assert.deepEqual(getPlatformCapabilities("desktop"), {
    canUseNativeDialogs: true,
    canReadLocalFiles: true,
    kind: "desktop",
  });

  assert.deepEqual(getPlatformCapabilities("web"), {
    canUseNativeDialogs: false,
    canReadLocalFiles: false,
    kind: "web",
  });
});

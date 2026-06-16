import test from "node:test";
import assert from "node:assert/strict";

import { getPlatformCapabilities, type PlatformKind } from "./runtime.ts";

test("desktop capabilities expose native dialog support", () => {
  const capabilities = getPlatformCapabilities("desktop" satisfies PlatformKind);

  assert.equal(capabilities.kind, "desktop");
  assert.equal(capabilities.canUseNativeDialogs, true);
  assert.equal(capabilities.canReadLocalFiles, true);
});

test("web capabilities disable native integrations", () => {
  const capabilities = getPlatformCapabilities("web" satisfies PlatformKind);

  assert.equal(capabilities.kind, "web");
  assert.equal(capabilities.canUseNativeDialogs, false);
  assert.equal(capabilities.canReadLocalFiles, false);
});

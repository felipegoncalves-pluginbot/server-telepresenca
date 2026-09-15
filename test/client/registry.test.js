import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import { createFeatureRegistry } from "../../public/js/features/registry.js";
import { isFlashlightAvailable } from "../../public/js/protocol/capabilities.js";

test("opt-in feature mounts only when advertised", () => {
  let mounts = 0;
  let unmounts = 0;
  const registry = createFeatureRegistry([
    {
      id: "flashlight",
      optIn: true,
      isAvailable: isFlashlightAvailable,
      mount() {
        mounts += 1;
        return () => {
          unmounts += 1;
        };
      },
    },
  ]);

  registry.apply(null, {});
  assert.equal(mounts, 0);

  registry.apply({ locomotion: { backwardMode: "pulse" } }, {});
  assert.equal(mounts, 0);

  registry.apply({ flashlight: { available: true } }, {});
  assert.equal(mounts, 1);

  registry.apply({ flashlight: { available: true } }, {});
  assert.equal(mounts, 1);

  registry.apply(null, {});
  assert.equal(unmounts, 1);
});

test("legacy feature stays mounted without capabilities", () => {
  let mounts = 0;
  const registry = createFeatureRegistry([
    {
      id: "beep",
      optIn: false,
      isAvailable: (caps) => caps == null || caps.audio?.beep !== false,
      mount() {
        mounts += 1;
        return () => {};
      },
    },
  ]);
  registry.apply(null, {});
  assert.equal(mounts, 1);
});

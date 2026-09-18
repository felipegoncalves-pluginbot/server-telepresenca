import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import { beepFeature } from "../../public/js/features/beep.js";
import { flashlightFeature } from "../../public/js/features/flashlight.js";
import { createHeadFeature } from "../../public/js/features/head.js";
import { createLocomotionFeature } from "../../public/js/features/locomotion.js";
import { createPowerFeature } from "../../public/js/features/power.js";
import { createVolumeFeature } from "../../public/js/features/volume.js";

test("feature widgets expose id, opt-in and availability helpers", () => {
  assert.equal(flashlightFeature.id, "flashlight");
  assert.equal(flashlightFeature.optIn, true);
  assert.equal(
    flashlightFeature.isAvailable({ flashlight: { available: true } }),
    true,
  );
  assert.equal(flashlightFeature.isAvailable(null), false);

  assert.equal(beepFeature.id, "beep");
  assert.equal(beepFeature.optIn, false);
  assert.equal(beepFeature.isAvailable(null), true);
  assert.equal(beepFeature.isAvailable({ audio: { beep: false } }), false);

  const locomotion = createLocomotionFeature({}, (key) => key);
  assert.equal(locomotion.id, "locomotion");
  assert.equal(locomotion.optIn, false);
  assert.equal(locomotion.isAvailable(null), true);
  assert.equal(typeof locomotion.mount, "function");

  const head = createHeadFeature({}, (key) => key);
  assert.equal(head.id, "head");
  assert.equal(head.optIn, true);
  assert.equal(head.isAvailable(null), false);
  assert.equal(head.isAvailable({ head: { available: true } }), true);

  const power = createPowerFeature({}, (key) => key);
  assert.equal(power.id, "power");
  assert.equal(power.optIn, true);
  assert.equal(power.isAvailable(null), false);
  assert.equal(power.isAvailable({ power: { available: true } }), true);

  const volume = createVolumeFeature({}, (key) => key);
  assert.equal(volume.id, "volume");
  assert.equal(volume.optIn, true);
  assert.equal(volume.isAvailable(null), false);
  assert.equal(volume.isAvailable({ audio: { volume: true } }), true);
});

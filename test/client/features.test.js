import assert from "node:assert/strict";
import { test } from "node:test";
import { beepFeature } from "../../public/js/features/beep.js";
import { flashlightFeature } from "../../public/js/features/flashlight.js";
import { createLocomotionFeature } from "../../public/js/features/locomotion.js";

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
});

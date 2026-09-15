import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import {
  backwardPulseDistanceM,
  isBeepAvailable,
  isContinuousBackward,
  isFlashlightAvailable,
  isLocomotionAvailable,
  normalizeCapabilities,
} from "../../public/js/protocol/capabilities.js";
import { compileSchema, readJson } from "../helpers/load-schema.js";

const validate = compileSchema("schemas/capabilities.schema.json");
const cruzr = readJson("test/fixtures/cruzr-capabilities.json");
const flashlightRobot = readJson("test/fixtures/flashlight-robot.json");

test("Cruzr fixture matches capabilities schema", () => {
  assert.equal(validate(cruzr), true, JSON.stringify(validate.errors));
});

test("flashlight robot matches capabilities schema", () => {
  assert.equal(validate(flashlightRobot), true, JSON.stringify(validate.errors));
});

test("unknown modules are allowed on the root object", () => {
  assert.equal(validate({ lidar: { available: true } }), true);
});

test("legacy HUD stays on without capabilities", () => {
  assert.equal(isLocomotionAvailable(null), true);
  assert.equal(isBeepAvailable(null), true);
  assert.equal(isFlashlightAvailable(null), false);
});

test("flashlight is opt-in", () => {
  assert.equal(isFlashlightAvailable(cruzr), false);
  assert.equal(isFlashlightAvailable(flashlightRobot), true);
});

test("beep can be explicitly disabled", () => {
  assert.equal(isBeepAvailable({ audio: { beep: false } }), false);
});

test("locomotion pulse vs continuous", () => {
  assert.equal(isContinuousBackward(cruzr), false);
  assert.equal(isContinuousBackward(flashlightRobot), true);
  assert.equal(isLocomotionAvailable({ locomotion: { available: false } }), false);
});

test("backward pulse defaults to 20cm", () => {
  assert.equal(backwardPulseDistanceM(null), 0.2);
  assert.equal(
    backwardPulseDistanceM({ locomotion: { backwardPulseDistanceM: 0.4 } }),
    0.4,
  );
});

test("normalizeCapabilities rejects non-objects", () => {
  assert.equal(normalizeCapabilities(null), null);
  assert.equal(normalizeCapabilities("x"), null);
  assert.deepEqual(normalizeCapabilities({ flashlight: { available: true } }), {
    flashlight: { available: true },
  });
});

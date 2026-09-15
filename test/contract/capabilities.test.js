import assert from "node:assert/strict";
import {
  isBeepAvailable,
  isContinuousBackward,
  isFlashlightAvailable,
  isLocomotionAvailable,
} from "../../public/js/protocol/capabilities.js";
import test from "../helpers/harness.js";
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

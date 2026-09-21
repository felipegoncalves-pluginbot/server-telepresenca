import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import { compileSchema, readJson } from "../helpers/load-schema.js";

const validate = compileSchema("schemas/control.schema.json");
const schema = readJson("schemas/control.schema.json");

test("stable locomotion and beep actions validate", () => {
  for (const action of ["beep", "forward", "backward", "left", "right", "stop"]) {
    assert.equal(validate({ action }), true, action);
  }
});

test("namespaced ring actions validate", () => {
  for (const action of ["ring.start", "ring.stop", "ring.toggle"]) {
    assert.equal(validate({ action }), true, action);
  }
});

test("namespaced flashlight actions validate", () => {
  for (const action of ["flashlight.on", "flashlight.off", "flashlight.toggle"]) {
    assert.equal(validate({ action }), true, action);
  }
});

test("namespaced head actions validate", () => {
  assert.equal(validate({ action: "head.reset" }), true);
  assert.equal(
    validate({ action: "head.look", value: { yaw: 0.2, pitch: -0.1 } }),
    true,
  );
});

test("volume.set with level validates", () => {
  assert.equal(validate({ action: "volume.set", value: { level: 5 } }), true);
});

test("schema examples are valid", () => {
  for (const example of schema.examples) {
    assert.equal(validate(example), true, JSON.stringify(example));
  }
});

test("uppercase actions are rejected by the contract (not by the server)", () => {
  assert.equal(validate({ action: "Beep" }), false);
});

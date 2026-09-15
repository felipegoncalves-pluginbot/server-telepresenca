import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import {
  addLook,
  clampAxis,
  clampLook,
  grabStep,
  lookKeyDelta,
  parseLookValue,
} from "../../public/js/protocol/look.js";
import { createHeadLookSurface } from "../../public/js/head-look.js";
import { createHeadFeature } from "../../public/js/features/head.js";
import { headAxes, isHeadAvailable } from "../../public/js/protocol/capabilities.js";

test("Street View grab: drag right looks left, drag down looks up", () => {
  const step = grabStep(100, 50, { width: 200, height: 200, sensitivity: 1.4 });
  assert.equal(step.yaw, -0.7);
  assert.equal(step.pitch, 0.35);
});

test("look pose clamps to the unit square", () => {
  assert.equal(clampAxis(2), 1);
  assert.equal(clampAxis(-4), -1);
  assert.equal(clampAxis("x"), 0);
  assert.deepEqual(clampLook({ yaw: 8, pitch: -3 }), { yaw: 1, pitch: -1 });
});

test("addLook respects disabled axes", () => {
  const next = addLook(
    { yaw: 0.2, pitch: 0.1 },
    { yaw: 0.5, pitch: 0.5 },
    { yaw: false },
  );
  assert.equal(next.yaw, 0.2);
  assert.equal(next.pitch, 0.6);
});

test("IJKL looks in the key direction", () => {
  assert.deepEqual(lookKeyDelta("i"), { yaw: 0, pitch: 1 });
  assert.deepEqual(lookKeyDelta("k"), { yaw: 0, pitch: -1 });
  assert.deepEqual(lookKeyDelta("j"), { yaw: -1, pitch: 0 });
  assert.deepEqual(lookKeyDelta("l"), { yaw: 1, pitch: 0 });
  assert.equal(lookKeyDelta("w"), null);
});

test("parseLookValue fills missing axes", () => {
  assert.deepEqual(parseLookValue(null), { yaw: 0, pitch: 0 });
  assert.deepEqual(parseLookValue({ yaw: 0.25 }), { yaw: 0.25, pitch: 0 });
});

test("head capability is opt-in", () => {
  assert.equal(isHeadAvailable(null), false);
  assert.equal(isHeadAvailable({}), false);
  assert.equal(isHeadAvailable({ head: { available: true } }), true);
  assert.deepEqual(headAxes({ head: { available: true, yaw: false } }), {
    yaw: false,
    pitch: true,
  });
});

test("head feature mounts only when advertised", () => {
  const feature = createHeadFeature({}, (key) => key);
  assert.equal(feature.id, "head");
  assert.equal(feature.optIn, true);
  assert.equal(feature.isAvailable(null), false);
  assert.equal(feature.isAvailable({ head: { available: true } }), true);
});

function mockLayer() {
  const listeners = {};
  const classes = new Set();
  return {
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      toggle(name, on) {
        if (on) classes.add(name);
        else classes.delete(name);
      },
      has: (name) => classes.has(name),
    },
    style: {},
    setAttribute() {},
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
    removeEventListener(type) {
      delete listeners[type];
    },
    setPointerCapture() {},
    getBoundingClientRect() {
      return { width: 200, height: 100, left: 0, top: 0 };
    },
    listeners,
    classes,
  };
}

test("head-look surface reports grab deltas while dragging", () => {
  const layer = mockLayer();
  const deltas = [];
  const surface = createHeadLookSurface(layer, {
    onDelta: (delta) => deltas.push(delta),
    rect: () => ({ width: 200, height: 100, left: 0, top: 0 }),
  });
  layer.listeners.pointerdown({
    pointerId: 1,
    button: 0,
    clientX: 80,
    clientY: 40,
    preventDefault() {},
  });
  layer.listeners.pointermove({
    pointerId: 1,
    clientX: 100,
    clientY: 50,
    preventDefault() {},
  });
  assert.equal(deltas.length, 1);
  assert.ok(deltas[0].yaw < 0, "drag right looks left");
  assert.ok(deltas[0].pitch > 0, "drag down looks up");
  surface.destroy();
});

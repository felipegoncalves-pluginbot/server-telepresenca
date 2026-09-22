import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import {
  computeIntegerDrawRect,
  computeIntegerVideoLayout,
} from "../../public/js/media/remote-layout.js";

test("computeIntegerVideoLayout letterboxes wide viewport with integer pixels", () => {
  const layout = computeIntegerVideoLayout(1920, 900, 1280, 720);
  assert.ok(layout);
  assert.equal(layout.height, 900);
  assert.equal(layout.width, Math.floor(900 * (1280 / 720)));
  assert.equal(layout.top, 0);
  assert.equal(layout.left, Math.floor((1920 - layout.width) / 2));
});

test("computeIntegerVideoLayout pillarboxes tall viewport", () => {
  const layout = computeIntegerVideoLayout(800, 1200, 1280, 720);
  assert.ok(layout);
  assert.equal(layout.width, 800);
  assert.equal(layout.height, Math.floor(800 / (1280 / 720)));
  assert.equal(layout.top, Math.floor((1200 - layout.height) / 2));
});

test("computeIntegerVideoLayout rejects invalid input", () => {
  assert.equal(computeIntegerVideoLayout(0, 900, 1280, 720), null);
  assert.equal(computeIntegerVideoLayout(800, 900, 0, 720), null);
});

test("computeIntegerDrawRect letterboxes with integer pixels", () => {
  const rect = computeIntegerDrawRect(960, 540, 1280, 720);
  assert.equal(rect.w, 960);
  assert.equal(rect.h, 540);
  assert.equal(rect.x, 0);
  assert.equal(rect.y, 0);
});

test("computeIntegerDrawRect centers odd-sized box", () => {
  const rect = computeIntegerDrawRect(961, 541, 1280, 720);
  assert.equal(rect.w, 961);
  assert.equal(rect.h, 540);
  assert.equal(rect.x, 0);
  assert.equal(rect.y, 0);
});

import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import {
  loadSavedPresetId,
  resolveVideoCapabilities,
  savePresetId,
} from "../../public/js/features/video-quality.js";
import { captureFormatKey } from "../../public/js/webrtc/quality.js";

const store = {};
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: {
    getItem(key) {
      return key in store ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
  },
});

test("resolveVideoCapabilities uses robot presets when present", () => {
  const caps = resolveVideoCapabilities({
    video: {
      defaultPreset: "high",
      presets: [
        { id: "auto", adaptive: true },
        { id: "high", width: 1280, height: 720, fps: 30, maxBitrateKbps: 2500 },
      ],
    },
  });
  assert.equal(caps.defaultPreset, "high");
  assert.equal(caps.presets.length, 2);
});

test("resolveVideoCapabilities falls back to five default presets", () => {
  const fallback = resolveVideoCapabilities(null);
  assert.equal(fallback.presets.length, 5);
  assert.equal(fallback.defaultPreset, "high");
  const byId = Object.fromEntries(fallback.presets.map((item) => [item.id, item]));
  assert.equal(byId.low.width, 640);
  assert.equal(byId.low.height, 480);
  assert.equal(byId.max.width, 1920);
  assert.equal(byId.max.height, 1080);
});

test("preset persistence", () => {
  savePresetId("mid");
  assert.equal(loadSavedPresetId("high"), "mid");
});

test("normalize a single robot preset", () => {
  const normalized = resolveVideoCapabilities({
    video: {
      presets: [{ id: "low", width: 640, height: 360, fps: 15, maxBitrateKbps: 800 }],
    },
  });
  assert.equal(normalized.presets[0].id, "low");
  assert.equal(normalized.presets[0].maxBitrateKbps, 800);
});

test("captureFormatKey", () => {
  assert.equal(
    captureFormatKey({ id: "high", width: 1280, height: 720, fps: 30 }),
    "1280x720@30",
  );
  assert.equal(captureFormatKey({ id: "auto", adaptive: true }), "auto");
});

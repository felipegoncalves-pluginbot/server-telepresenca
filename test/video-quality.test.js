const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "public", "video-quality.js"),
  "utf8",
);

const context = { window: {}, localStorage: { store: {}, getItem(k) { return this.store[k] || null; }, setItem(k, v) { this.store[k] = String(v); } } };
context.window.localStorage = context.localStorage;
vm.runInNewContext(source, context);

const VQ = context.window.TeleVideoQuality;
assert.ok(VQ, "TeleVideoQuality must be exported");

const caps = VQ.resolveVideoCapabilities({
  video: {
    defaultPreset: "high",
    presets: [
      { id: "auto", adaptive: true },
      { id: "high", width: 1280, height: 720, fps: 30, maxBitrateKbps: 2500 },
    ],
  },
});
assert.strictEqual(caps.defaultPreset, "high");
assert.strictEqual(caps.presets.length, 2);

const fallback = VQ.resolveVideoCapabilities(null);
assert.strictEqual(fallback.presets.length, 5);
assert.strictEqual(fallback.defaultPreset, "high");

VQ.savePresetId("mid");
assert.strictEqual(VQ.loadSavedPresetId("high"), "mid");

const normalized = VQ.resolveVideoCapabilities({
  video: { presets: [{ id: "low", width: 640, height: 360, fps: 15, maxBitrateKbps: 800 }] },
});
assert.strictEqual(normalized.presets[0].id, "low");
assert.strictEqual(normalized.presets[0].maxBitrateKbps, 800);

assert.strictEqual(VQ.captureFormatKey({ id: "high", width: 1280, height: 720, fps: 30 }), "1280x720@30");
assert.strictEqual(VQ.captureFormatKey({ id: "auto", adaptive: true }), "auto");

console.log("video-quality ok");

import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import { createFeatureRegistry } from "../../public/js/features/registry.js";
import { volumeRange } from "../../public/js/protocol/capabilities.js";
import { parseRobotStatus, parseVolumeLevel } from "../../public/js/protocol/status.js";

test("parseRobotStatus reads battery advertised on join capabilities", () => {
  const parsed = parseRobotStatus({
    power: { available: true, level: 64, charging: false },
  });
  assert.deepEqual(parsed.power, { level: 64, charging: false });
});

test("parseRobotStatus ignores incomplete payloads", () => {
  assert.deepEqual(parseRobotStatus(null), { power: null, audio: null });
  assert.equal(parseRobotStatus({ power: { charging: true } }).power, null);
  assert.equal(parseRobotStatus({ audio: { min: 0 } }).audio, null);
});

test("parseVolumeLevel clamps object and number values", () => {
  assert.equal(parseVolumeLevel({ level: 12 }, 0, 10, 5), 10);
  assert.equal(parseVolumeLevel({ volume: -2 }, 0, 10, 5), 0);
  assert.equal(parseVolumeLevel(7, 0, 15, 5), 7);
  assert.equal(parseVolumeLevel("x", 0, 10, 4), 4);
});

test("volumeRange uses advertised min/max", () => {
  assert.deepEqual(volumeRange({ audio: { volumeMin: 0, volumeMax: 15 } }), {
    min: 0,
    max: 15,
  });
  assert.deepEqual(volumeRange(null), { min: 0, max: 10 });
});

test("registry applyStatus reaches mounted features", () => {
  const seen = [];
  const registry = createFeatureRegistry([
    {
      id: "power",
      optIn: true,
      isAvailable: (caps) => caps?.power?.available === true,
      mount() {
        return () => {};
      },
      onStatus(payload) {
        seen.push(payload);
      },
    },
  ]);
  registry.apply(null, {});
  registry.applyStatus({ power: { level: 10 } });
  assert.equal(seen.length, 0);

  registry.apply({ power: { available: true } }, {});
  assert.equal(seen.length, 1, "late mount must replay the last status");
  registry.applyStatus({ power: { level: 40, charging: false } });
  assert.equal(seen.length, 2);
  assert.equal(seen[1].power.level, 40);
});

test("registry replays last status when a feature mounts late", () => {
  const seen = [];
  const registry = createFeatureRegistry([
    {
      id: "power",
      optIn: true,
      isAvailable: (caps) => caps?.power?.available === true,
      mount() {
        return () => {};
      },
      onStatus(payload) {
        seen.push(payload);
      },
    },
  ]);
  registry.applyStatus({ power: { level: 88, charging: true } });
  assert.equal(seen.length, 0);
  registry.apply({ power: { available: true } }, {});
  assert.equal(seen.length, 1);
  assert.equal(seen[0].power.level, 88);
});

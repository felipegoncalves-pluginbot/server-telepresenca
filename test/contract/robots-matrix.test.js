import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import {
  isBeepAvailable,
  isContinuousBackward,
  isFlashlightAvailable,
  isHeadAvailable,
  isLocomotionAvailable,
} from "../../public/js/protocol/capabilities.js";
import { compileSchema, readJson } from "../helpers/load-schema.js";

const validate = compileSchema("schemas/capabilities.schema.json");

const robots = [
  {
    name: "cruzr",
    caps: readJson("test/fixtures/cruzr-capabilities.json"),
    hud: {
      locomotion: true,
      beep: true,
      flashlight: false,
      head: true,
      continuousBackward: false,
    },
  },
  {
    name: "sanbot-flashlight",
    caps: readJson("test/fixtures/sanbot-flashlight.json"),
    hud: {
      locomotion: true,
      beep: true,
      flashlight: true,
      head: false,
      continuousBackward: true,
    },
  },
  {
    name: "generic-empty-object",
    caps: readJson("test/fixtures/generic-robot-no-caps.json"),
    hud: {
      locomotion: true,
      beep: true,
      flashlight: false,
      head: false,
      continuousBackward: false,
    },
  },
  {
    name: "app-telepresenca-null-caps",
    caps: null,
    hud: {
      locomotion: true,
      beep: true,
      flashlight: false,
      head: false,
      continuousBackward: false,
    },
  },
];

for (const robot of robots) {
  test(`${robot.name} fixture matches the HUD contract`, () => {
    if (robot.caps !== null) {
      assert.equal(
        validate(robot.caps),
        true,
        `${robot.name}: ${JSON.stringify(validate.errors)}`,
      );
    }
    assert.equal(isLocomotionAvailable(robot.caps), robot.hud.locomotion, "locomotion");
    assert.equal(isBeepAvailable(robot.caps), robot.hud.beep, "beep");
    assert.equal(isFlashlightAvailable(robot.caps), robot.hud.flashlight, "flashlight");
    assert.equal(isHeadAvailable(robot.caps), robot.hud.head, "head");
    assert.equal(
      isContinuousBackward(robot.caps),
      robot.hud.continuousBackward,
      "backward",
    );
  });
}

test("HUD helpers ignore robotModel and only read capabilities", () => {
  assert.equal(
    isFlashlightAvailable({
      robotModel: "cruzr-1s",
      flashlight: { available: false },
    }),
    false,
  );
  assert.equal(
    isFlashlightAvailable({
      robotModel: "sanbot-elf",
      flashlight: { available: true },
    }),
    true,
  );
  assert.equal(
    isFlashlightAvailable({ robotModel: "sanbot-elf" }),
    false,
    "brand alone must not enable flashlight",
  );
  assert.equal(
    isHeadAvailable({ robotModel: "cruzr-1s" }),
    false,
    "brand alone must not enable head look",
  );
});

test("legacy HUD can be turned off explicitly", () => {
  assert.equal(isLocomotionAvailable({ locomotion: { available: false } }), false);
  assert.equal(isBeepAvailable({ audio: { beep: false } }), false);
});

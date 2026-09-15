import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import { createRoomStore } from "../../src/rooms/store.js";

test("roomState reports occupancy and opaque capabilities", () => {
  const rooms = createRoomStore();
  const room = rooms.ensure("sala");
  room.operator = "op-1";
  room.robot = "bot-1";
  room.robotCapabilities = { flashlight: { available: true } };
  rooms.set("sala", room);

  const state = rooms.state("sala");
  assert.equal(state.operator, true);
  assert.equal(state.robot, true);
  assert.equal(state.robotCapabilities.flashlight.available, true);
});

test("missing room has empty state", () => {
  const rooms = createRoomStore();
  const state = rooms.state("missing");
  assert.equal(state.operator, false);
  assert.equal(state.robot, false);
  assert.equal(state.robotCapabilities, null);
});

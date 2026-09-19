import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import {
  clearExpiryTimer,
  occupantSockets,
  expiryDelayMs,
  shouldExpireRoom,
  EVENT_SESSION_EXPIRED,
} from "../../src/rooms/lifecycle.js";

test("expiryDelayMs is null without a timestamp and negative when due", () => {
  assert.equal(expiryDelayMs(null), null);
  assert.equal(expiryDelayMs(undefined), null);
  assert.equal(expiryDelayMs(1_000, 1_500), -500);
  assert.equal(expiryDelayMs(2_000, 1_000), 1_000);
  assert.equal(EVENT_SESSION_EXPIRED, "session-expired");
});

test("shouldExpireRoom matches isExpired", () => {
  assert.equal(shouldExpireRoom(1_000, 1_001), true);
  assert.equal(shouldExpireRoom(1_000, 999), false);
  assert.equal(shouldExpireRoom(null, 1), false);
});

test("occupantSockets lists operator and robot ids", () => {
  assert.deepEqual(occupantSockets({}), []);
  assert.deepEqual(occupantSockets({ operator: "op-1", robot: "bot-1" }), [
    { role: "operator", socketId: "op-1" },
    { role: "robot", socketId: "bot-1" },
  ]);
});

test("clearExpiryTimer drops the handle", () => {
  const room = { expiryTimer: setTimeout(() => {}, 60_000) };
  clearExpiryTimer(room);
  assert.equal(room.expiryTimer, null);
});

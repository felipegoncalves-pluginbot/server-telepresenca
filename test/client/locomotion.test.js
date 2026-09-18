import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import { LOCOMOTION_HEARTBEAT_INTERVAL_MS, createLocomotionFeature } from "../../public/js/features/locomotion.js";

test("locomotion heartbeat interval is 80ms for low latency (<100ms)", () => {
  assert.equal(LOCOMOTION_HEARTBEAT_INTERVAL_MS, 80);
});

test("locomotion stopMovement dispatches non-volatile stop command", () => {
  let dispatchedAction = null;
  let dispatchedOpts = null;

  const mockCtx = {
    isConnected: () => true,
    sendControl: (action, value, opts) => {
      dispatchedAction = action;
      dispatchedOpts = opts;
    },
  };

  const stick = { style: {} };
  const mockJoystickEl = {
    querySelector: () => stick,
    classList: { toggle: () => {}, remove: () => {}, add: () => {} },
    setAttribute: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const feature = createLocomotionFeature({ joystick: mockJoystickEl }, (k) => k);
  feature.mount(mockCtx, {
    locomotion: { continuousBackward: true },
  });

  // Dispara início e parada de movimento
  feature.startMovement("forward");
  feature.stopMovement(true);

  assert.equal(dispatchedAction, "stop");
  assert.equal(dispatchedOpts?.volatile, false, "Comando stop nunca deve ser volátil");
});

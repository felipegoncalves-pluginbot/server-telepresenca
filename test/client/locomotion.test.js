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

test("locomotion key rollover: pressing S while holding W switches to backward, releasing W does NOT stop backward", () => {
  const dispatched = [];

  const mockCtx = {
    isConnected: () => true,
    sendControl: (action, value, opts) => {
      dispatched.push({ action, opts });
    },
  };

  const feature = createLocomotionFeature({}, (k) => k);
  feature.mount(mockCtx);
  feature.update({ locomotion: { backwardMode: "continuous" } }, mockCtx);

  // 1. Operador pressiona 'w' -> inicia forward
  feature.onKeyDown({ key: "w", preventDefault: () => {} });
  assert.equal(feature.getActiveMovement(), "forward");
  assert.equal(dispatched[dispatched.length - 1].action, "forward");

  // 2. Operador pressiona 's' rapidamente enquanto 'w' ainda está pressionado (rollover)
  feature.onKeyDown({ key: "s", preventDefault: () => {} });
  assert.equal(feature.getActiveMovement(), "backward");
  assert.equal(dispatched[dispatched.length - 1].action, "backward");

  // 3. Operador solta 'w' (keyUp de W) -> NÃO PODE parar a ré nem emitir stop!
  feature.onKeyUp({ key: "w", preventDefault: () => {} });
  assert.equal(feature.getActiveMovement(), "backward", "Ao soltar W, S continua ativo");
  assert.notEqual(dispatched[dispatched.length - 1].action, "stop", "Não deve emitir stop ao soltar tecla inativa");

  // 4. Operador finalmente solta 's' -> agora sim emite stop
  feature.onKeyUp({ key: "s", preventDefault: () => {} });
  assert.equal(feature.getActiveMovement(), null);
  assert.equal(dispatched[dispatched.length - 1].action, "stop");
});

test("locomotion pulse backward stops forward heartbeat when robot lacks continuous backward", () => {
  const dispatched = [];

  const mockCtx = {
    isConnected: () => true,
    sendControl: (action, value, opts) => {
      dispatched.push({ action, opts });
    },
  };

  const feature = createLocomotionFeature({}, (k) => k);
  feature.mount(mockCtx);
  feature.update({ locomotion: { backwardMode: "pulse" } }, mockCtx);

  // Inicia avanço
  feature.onKeyDown({ key: "w", preventDefault: () => {} });
  assert.equal(feature.getActiveMovement(), "forward");

  // Pressiona ré em robô com pulse mode -> deve emitir pulso e parar o avanço contínuo
  feature.onKeyDown({ key: "s", preventDefault: () => {} });
  assert.equal(feature.getActiveMovement(), null, "Avanço contínuo deve ser interrompido");
  assert.equal(dispatched[dispatched.length - 1].action, "backward");
});


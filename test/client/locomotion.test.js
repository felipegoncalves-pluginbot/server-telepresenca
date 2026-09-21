import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "../helpers/test.js";
import {
  LOCOMOTION_HEARTBEAT_INTERVAL_MS,
  createLocomotionFeature,
} from "../../public/js/features/locomotion.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

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
  assert.equal(
    feature.getActiveMovement(),
    "backward",
    "Ao soltar W, S continua ativo",
  );
  assert.notEqual(
    dispatched[dispatched.length - 1].action,
    "stop",
    "Não deve emitir stop ao soltar tecla inativa",
  );

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
  assert.equal(
    feature.getActiveMovement(),
    null,
    "Avanço contínuo deve ser interrompido",
  );
  assert.equal(dispatched[dispatched.length - 1].action, "backward");
});

test("move-hud is positioned on the right for mobile/coarse touch screens", () => {
  const styleCss = fs.readFileSync(path.join(root, "public", "style.css"), "utf8");
  const mobileMediaMatch = styleCss.match(
    /@media\s*\(\s*max-width:\s*720px\s*\)\s*,\s*\(\s*pointer:\s*coarse\s*\)\s*\{([\s\S]*?)\n\}/,
  );
  assert.ok(mobileMediaMatch, "media query para mobile/coarse pointer deve existir");

  const mobileBlock = mobileMediaMatch[1];
  const moveHudMatch = mobileBlock.match(/\.move-hud\s*\{([^}]+)\}/);
  assert.ok(moveHudMatch, ".move-hud deve estar estilizado no breakpoint mobile");

  const moveHudStyles = moveHudMatch[1];
  assert.match(moveHudStyles, /left:\s*auto/, ".move-hud deve resetar left para auto");
  assert.match(
    moveHudStyles,
    /right:\s*max\(\s*12px\s*,\s*env\(safe-area-inset-right\)\s*\)/,
    ".move-hud deve ancorar na direita respeitando safe-area",
  );
});

test("move-hud is positioned on the left for desktop default layout", () => {
  const styleCss = fs.readFileSync(path.join(root, "public", "style.css"), "utf8");
  const desktopMoveHudMatch = styleCss.match(/\.move-hud\s*\{([^}]+)\}/);
  assert.ok(desktopMoveHudMatch, ".move-hud desktop padrão deve existir");

  const desktopStyles = desktopMoveHudMatch[1];
  assert.match(
    desktopStyles,
    /left:\s*max\(\s*12px\s*,\s*env\(safe-area-inset-left\)\s*\)/,
    ".move-hud desktop deve permanecer na esquerda com safe-area",
  );
});

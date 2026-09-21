import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import { beepFeature } from "../../public/js/features/beep.js";

function createMockButton() {
  const classList = new Set();
  const attributes = new Map();
  const listeners = new Map();

  return {
    hidden: true,
    disabled: false,
    classList: {
      add(cls) {
        classList.add(cls);
      },
      remove(cls) {
        classList.delete(cls);
      },
      contains(cls) {
        return classList.has(cls);
      },
    },
    setAttribute(name, val) {
      attributes.set(name, String(val));
    },
    getAttribute(name) {
      return attributes.get(name);
    },
    addEventListener(event, fn) {
      listeners.set(event, fn);
    },
    removeEventListener(event, fn) {
      if (listeners.get(event) === fn) {
        listeners.delete(event);
      }
    },
    click() {
      const fn = listeners.get("click");
      if (fn) {
        fn({ preventDefault() {} });
      }
    },
  };
}

test("beepFeature mounts, toggles ring.start and ring.stop with UI classes and attributes", () => {
  const mockButton = createMockButton();
  const originalGetElementById = globalThis.document?.getElementById;

  if (!globalThis.document) {
    globalThis.document = {};
  }
  globalThis.document.getElementById = (id) =>
    id === "btnSendCommand" ? mockButton : null;

  const sentControls = [];
  let connected = true;

  const ctx = {
    isConnected: () => connected,
    sendControl: (action, value) => {
      sentControls.push({ action, value });
    },
    t: (key) => (key === "media.ringStop" ? "Parar chamada" : "Tocar chamada no robô"),
  };

  try {
    const unmount = beepFeature.mount(ctx);

    assert.equal(mockButton.hidden, false);
    assert.equal(mockButton.getAttribute("aria-pressed"), "false");
    assert.equal(mockButton.getAttribute("aria-label"), "Tocar chamada no robô");
    assert.equal(mockButton.classList.contains("is-ringing"), false);
    assert.equal(beepFeature.isRinging(), false);

    // 1st click: Start ringing
    mockButton.click();
    assert.equal(sentControls.length, 1);
    assert.equal(sentControls[0].action, "ring.start");
    assert.equal(mockButton.getAttribute("aria-pressed"), "true");
    assert.equal(mockButton.getAttribute("aria-label"), "Parar chamada");
    assert.equal(mockButton.classList.contains("is-ringing"), true);
    assert.equal(beepFeature.isRinging(), true);

    // 2nd click: Stop ringing
    mockButton.click();
    assert.equal(sentControls.length, 2);
    assert.equal(sentControls[1].action, "ring.stop");
    assert.equal(mockButton.getAttribute("aria-pressed"), "false");
    assert.equal(mockButton.getAttribute("aria-label"), "Tocar chamada no robô");
    assert.equal(mockButton.classList.contains("is-ringing"), false);
    assert.equal(beepFeature.isRinging(), false);

    // Unmount cleanup
    unmount();
    assert.equal(mockButton.hidden, true);
  } finally {
    if (originalGetElementById) {
      globalThis.document.getElementById = originalGetElementById;
    } else {
      delete globalThis.document;
    }
  }
});

test("beepFeature stops ringing automatically on disconnect or setEnabled(false)", () => {
  const mockButton = createMockButton();
  const originalGetElementById = globalThis.document?.getElementById;

  if (!globalThis.document) {
    globalThis.document = {};
  }
  globalThis.document.getElementById = (id) =>
    id === "btnSendCommand" ? mockButton : null;

  let connected = true;
  const sentControls = [];
  const ctx = {
    isConnected: () => connected,
    sendControl: (action, value) => {
      sentControls.push({ action, value });
    },
    t: (key) => key,
  };

  try {
    const unmount = beepFeature.mount(ctx);

    mockButton.click();
    assert.equal(beepFeature.isRinging(), true);

    // Disconnection event resets ringing state
    connected = false;
    beepFeature.setEnabled(false);
    assert.equal(beepFeature.isRinging(), false);
    assert.equal(mockButton.classList.contains("is-ringing"), false);
    assert.equal(mockButton.getAttribute("aria-pressed"), "false");

    unmount();
  } finally {
    if (originalGetElementById) {
      globalThis.document.getElementById = originalGetElementById;
    } else {
      delete globalThis.document;
    }
  }
});

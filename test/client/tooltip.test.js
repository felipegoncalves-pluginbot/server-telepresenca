import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import { initTooltips } from "../../public/js/ui/tooltip.js";

/**
 * Creates a lightweight mock element for DOM testing in Node environment.
 * @param {string} tagName
 * @param {Record<string, string>} [initialAttrs]
 * @returns {any}
 */
function createMockElement(tagName, initialAttrs = {}) {
  const attributes = new Map(Object.entries(initialAttrs));
  const classList = new Set();
  const listeners = new Map();
  const children = [];

  const el = {
    tagName: tagName.toUpperCase(),
    textContent: "",
    disabled: false,
    style: {},
    children,
    parentElement: null,
    ownerDocument: null,
    classList: {
      add(...cls) {
        cls.forEach((c) => classList.add(c));
      },
      remove(...cls) {
        cls.forEach((c) => classList.delete(c));
      },
      contains(cls) {
        return classList.has(cls);
      },
      toggle(cls, force) {
        if (force === undefined) {
          if (classList.has(cls)) classList.delete(cls);
          else classList.add(cls);
        } else if (force) {
          classList.add(cls);
        } else {
          classList.delete(cls);
        }
      },
    },
    setAttribute(name, val) {
      attributes.set(name, String(val));
    },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    hasAttribute(name) {
      return attributes.has(name);
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    addEventListener(event, fn, useCapture = false) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push({ fn, useCapture: Boolean(useCapture) });
    },
    removeEventListener(event, fn, useCapture = false) {
      const list = listeners.get(event);
      if (!list) return;
      const idx = list.findIndex(
        (item) => item.fn === fn && item.useCapture === Boolean(useCapture),
      );
      if (idx !== -1) list.splice(idx, 1);
    },
    _getListeners(event) {
      return listeners.get(event) || [];
    },
    dispatchEvent(evt) {
      const eventObj = {
        target: el,
        currentTarget: el,
        preventDefault: () => {},
        stopPropagation: () => {},
        ...evt,
      };

      // 1. Build chain from root to el
      const chain = [];
      let curr = el;
      while (curr) {
        chain.unshift(curr);
        curr = curr.parentElement;
      }

      // 2. Capture phase (root down to parent)
      for (let i = 0; i < chain.length - 1; i++) {
        const node = chain[i];
        eventObj.currentTarget = node;
        const nodeListeners = node._getListeners ? node._getListeners(evt.type) : [];
        for (const item of nodeListeners) {
          if (item.useCapture) item.fn(eventObj);
        }
      }

      // 3. Target phase
      eventObj.currentTarget = el;
      const targetListeners = el._getListeners(evt.type);
      for (const item of targetListeners) {
        item.fn(eventObj);
      }

      // 4. Bubble phase (parent up to root)
      for (let i = chain.length - 2; i >= 0; i--) {
        const node = chain[i];
        eventObj.currentTarget = node;
        const nodeListeners = node._getListeners ? node._getListeners(evt.type) : [];
        for (const item of nodeListeners) {
          if (!item.useCapture) item.fn(eventObj);
        }
      }
    },
    appendChild(child) {
      children.push(child);
      child.parentElement = el;
      return child;
    },
    removeChild(child) {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
      child.parentElement = null;
      return child;
    },
    remove() {
      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
    },
    matches(sel) {
      if (sel === ".ctrl") return classList.has("ctrl");
      return false;
    },
    closest(sel) {
      if (el.matches(sel)) return el;
      if (el.parentElement && typeof el.parentElement.closest === "function") {
        return el.parentElement.closest(sel);
      }
      return null;
    },
    getBoundingClientRect() {
      return { top: 100, bottom: 148, left: 200, right: 248, width: 48, height: 48 };
    },
    querySelectorAll(selector) {
      return children.filter((child) => {
        if (selector === ".ctrl") return child.classList.contains("ctrl");
        return false;
      });
    },
  };

  return el;
}

function setupMockDom() {
  const body = createMockElement("body");
  const doc = {
    body,
    createElement(tag) {
      const el = createMockElement(tag);
      el.ownerDocument = doc;
      return el;
    },
    getElementById(id) {
      if (id === "hudTooltip") {
        return body.children.find((c) => c.getAttribute("id") === "hudTooltip") || null;
      }
      return null;
    },
    addEventListener(event, fn) {
      body.addEventListener(event, fn);
    },
    removeEventListener(event, fn) {
      body.removeEventListener(event, fn);
    },
    dispatchEvent(evt) {
      body.dispatchEvent(evt);
    },
  };
  body.ownerDocument = doc;
  return { doc, body };
}

test("initTooltips mounts singleton and shows on hover with delay", async () => {
  const { doc, body } = setupMockDom();
  const btn = doc.createElement("button");
  btn.classList.add("ctrl");
  btn.setAttribute("aria-label", "Ligar microfone");
  body.appendChild(btn);

  const controller = initTooltips(body, ".ctrl", {
    enterDelayMs: 20,
    warmWindowMs: 50,
    doc,
  });

  const tooltipEl = body.children.find((c) => c.getAttribute("role") === "tooltip");
  assert.ok(tooltipEl, "Tooltip singleton element should be created in DOM");
  assert.equal(tooltipEl.getAttribute("aria-hidden"), "true");

  // Mouse enter button
  btn.dispatchEvent({ type: "mouseenter" });
  assert.equal(tooltipEl.getAttribute("aria-hidden"), "true");

  // Wait for enterDelayMs
  await new Promise((r) => setTimeout(r, 35));
  assert.equal(tooltipEl.getAttribute("aria-hidden"), "false");
  assert.ok(tooltipEl.classList.contains("is-visible"));
  assert.equal(tooltipEl.textContent, "Ligar microfone");

  // Mouse leave button
  btn.dispatchEvent({ type: "mouseleave" });
  assert.equal(tooltipEl.getAttribute("aria-hidden"), "true");
  assert.equal(tooltipEl.classList.contains("is-visible"), false);

  controller.destroy();
});

test("initTooltips provides warm-delay instant transition between adjacent buttons", async () => {
  const { doc, body } = setupMockDom();
  const btn1 = doc.createElement("button");
  btn1.classList.add("ctrl");
  btn1.setAttribute("aria-label", "Ligar microfone");
  body.appendChild(btn1);

  const btn2 = doc.createElement("button");
  btn2.classList.add("ctrl");
  btn2.setAttribute("aria-label", "Ligar câmera");
  body.appendChild(btn2);

  const controller = initTooltips(body, ".ctrl", {
    enterDelayMs: 50,
    warmWindowMs: 200,
    doc,
  });

  const tooltipEl = body.children.find((c) => c.getAttribute("role") === "tooltip");

  // Hover btn1 and wait
  btn1.dispatchEvent({ type: "mouseenter" });
  await new Promise((r) => setTimeout(r, 65));
  assert.equal(tooltipEl.textContent, "Ligar microfone");

  // Leave btn1 and immediately enter btn2
  btn1.dispatchEvent({ type: "mouseleave" });
  btn2.dispatchEvent({ type: "mouseenter" });

  // In warm window, transition should be instant without waiting 50ms
  assert.equal(tooltipEl.getAttribute("aria-hidden"), "false");
  assert.equal(tooltipEl.textContent, "Ligar câmera");

  controller.destroy();
});

test("initTooltips closes on Escape and on button click", async () => {
  const { doc, body } = setupMockDom();
  const btn = doc.createElement("button");
  btn.classList.add("ctrl");
  btn.setAttribute("aria-label", "Encerrar");
  body.appendChild(btn);

  const controller = initTooltips(body, ".ctrl", {
    enterDelayMs: 10,
    warmWindowMs: 50,
    doc,
  });

  const tooltipEl = body.children.find((c) => c.getAttribute("role") === "tooltip");

  // Open tooltip
  btn.dispatchEvent({ type: "mouseenter" });
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(tooltipEl.getAttribute("aria-hidden"), "false");

  // Press Escape
  doc.dispatchEvent({ type: "keydown", key: "Escape" });
  assert.equal(tooltipEl.getAttribute("aria-hidden"), "true");

  // Re-open and test button click dismiss
  btn.dispatchEvent({ type: "mouseenter" });
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(tooltipEl.getAttribute("aria-hidden"), "false");

  btn.dispatchEvent({ type: "click" });
  assert.equal(tooltipEl.getAttribute("aria-hidden"), "true");

  controller.destroy();
});

test("initTooltips supports keyboard focusin and focusout", async () => {
  const { doc, body } = setupMockDom();
  const btn = doc.createElement("button");
  btn.classList.add("ctrl");
  btn.setAttribute("aria-label", "Qualidade de vídeo");
  body.appendChild(btn);

  const controller = initTooltips(body, ".ctrl", {
    enterDelayMs: 20,
    warmWindowMs: 50,
    doc,
  });

  const tooltipEl = body.children.find((c) => c.getAttribute("role") === "tooltip");

  btn.dispatchEvent({ type: "focusin" });
  await new Promise((r) => setTimeout(r, 35));
  assert.equal(tooltipEl.getAttribute("aria-hidden"), "false");
  assert.equal(tooltipEl.textContent, "Qualidade de vídeo");

  btn.dispatchEvent({ type: "focusout" });
  assert.equal(tooltipEl.getAttribute("aria-hidden"), "true");

  controller.destroy();
});

test("initTooltips manages is-sliding class for smooth warm transitions between adjacent targets", async () => {
  const { doc, body } = setupMockDom();
  const btn1 = doc.createElement("button");
  btn1.classList.add("ctrl");
  btn1.setAttribute("aria-label", "Microfone");
  btn1.getBoundingClientRect = () => ({
    top: 100,
    bottom: 148,
    left: 200,
    right: 248,
    width: 48,
    height: 48,
  });
  body.appendChild(btn1);

  const btn2 = doc.createElement("button");
  btn2.classList.add("ctrl");
  btn2.setAttribute("aria-label", "Câmera");
  btn2.getBoundingClientRect = () => ({
    top: 100,
    bottom: 148,
    left: 260,
    right: 308,
    width: 48,
    height: 48,
  });
  body.appendChild(btn2);

  const controller = initTooltips(body, ".ctrl", {
    enterDelayMs: 20,
    warmWindowMs: 150,
    doc,
  });

  const tooltipEl = body.children.find((c) => c.getAttribute("role") === "tooltip");

  // 1. Initial cold hover: is-sliding must be FALSE
  btn1.dispatchEvent({ type: "mouseenter" });
  await new Promise((r) => setTimeout(r, 35));
  assert.equal(tooltipEl.getAttribute("aria-hidden"), "false");
  assert.equal(tooltipEl.classList.contains("is-visible"), true);
  assert.equal(tooltipEl.classList.contains("is-sliding"), false);
  assert.equal(tooltipEl.style.left, "224px"); // 200 + 48/2

  // 2. Transition to adjacent button in warm window: is-sliding must be TRUE
  btn1.dispatchEvent({ type: "mouseleave" });
  btn2.dispatchEvent({ type: "mouseenter" });
  assert.equal(tooltipEl.getAttribute("aria-hidden"), "false");
  assert.equal(tooltipEl.classList.contains("is-sliding"), true);
  assert.equal(tooltipEl.style.left, "284px"); // 260 + 48/2

  // 3. Leaving button: is-sliding and is-visible must be cleared
  btn2.dispatchEvent({ type: "mouseleave" });
  assert.equal(tooltipEl.getAttribute("aria-hidden"), "true");
  assert.equal(tooltipEl.classList.contains("is-visible"), false);
  assert.equal(tooltipEl.classList.contains("is-sliding"), false);

  // 4. Waiting past warm window, cold hover again: is-sliding must be FALSE
  await new Promise((r) => setTimeout(r, 180));
  btn2.dispatchEvent({ type: "mouseenter" });
  await new Promise((r) => setTimeout(r, 35));
  assert.equal(tooltipEl.getAttribute("aria-hidden"), "false");
  assert.equal(tooltipEl.classList.contains("is-visible"), true);
  assert.equal(tooltipEl.classList.contains("is-sliding"), false);

  controller.destroy();
});

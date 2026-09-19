import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import {
  createSessionCountdown,
  formatRemaining,
  remainingMs,
  urgencyForRemaining,
} from "../../public/js/invite/countdown.js";

test("formatRemaining stays compact and tabular", () => {
  assert.equal(formatRemaining(5000), "0:05");
  assert.equal(formatRemaining(65 * 1000), "1:05");
  assert.equal(formatRemaining(5 * 60 * 1000), "5:00");
  assert.equal(formatRemaining(3661000), "1:01:01");
  assert.equal(formatRemaining(0), "0:00");
  assert.equal(formatRemaining(null), "");
});

test("urgency stays quiet until the last minutes", () => {
  assert.equal(urgencyForRemaining(null), "idle");
  assert.equal(urgencyForRemaining(6 * 60 * 1000), "ok");
  assert.equal(urgencyForRemaining(5 * 60 * 1000), "warn");
  assert.equal(urgencyForRemaining(60 * 1000), "critical");
  assert.equal(urgencyForRemaining(0), "ended");
});

test("createSessionCountdown hides when the call has no expiry", () => {
  const el = {
    hidden: false,
    textContent: "x",
    dataset: {},
    title: "",
    removeAttribute(name) {
      if (name === "data-urgency") delete this.dataset.urgency;
    },
    setAttribute() {},
  };
  const countdown = createSessionCountdown({
    els: { sessionCountdown: el },
    t: (_key, vars) => (vars && vars.time) || "",
    expiresAt: null,
  });
  countdown.start();
  assert.equal(el.hidden, true);
  assert.equal(el.textContent, "");
});

test("createSessionCountdown paints remaining time", () => {
  const el = {
    hidden: true,
    textContent: "",
    dataset: {},
    title: "",
    removeAttribute() {},
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  const end = Date.parse("2026-09-19T13:10:00.000Z");
  const remaining = 12 * 60 * 1000 + 5 * 1000;
  const countdown = createSessionCountdown({
    els: { sessionCountdown: el },
    t: (_key, vars) => vars.time,
    expiresAt: "2026-09-19T13:10:00.000Z",
    now: () => end - remaining,
  });
  assert.equal(countdown.paint(), "ok");
  assert.equal(el.hidden, false);
  assert.equal(el.textContent, "12:05");
  assert.equal(el.dataset.urgency, "ok");
  assert.equal(remainingMs("2026-09-19T13:10:00.000Z", end - remaining), remaining);
});

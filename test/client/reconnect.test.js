import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import {
  canRejoinInvite,
  endedOverlayState,
  isTransientDisconnect,
  paintCallEnded,
  RECONNECT_GRACE_MS,
} from "../../public/js/invite/reconnect.js";

test("transient disconnects are transport failures, not explicit kicks", () => {
  assert.equal(isTransientDisconnect("transport close"), true);
  assert.equal(isTransientDisconnect("ping timeout"), true);
  assert.equal(isTransientDisconnect("io server disconnect"), false);
  assert.equal(isTransientDisconnect("io client disconnect"), false);
  assert.equal(RECONNECT_GRACE_MS, 20_000);
});

test("invite rejoin is allowed only while the window is open", () => {
  const end = "2026-09-19T13:15:00.000Z";
  const now = Date.parse(end);
  assert.equal(canRejoinInvite(false, end, now + 1), true);
  assert.equal(canRejoinInvite(true, end, now - 1), true);
  assert.equal(canRejoinInvite(true, end, now + 1), false);
  assert.equal(canRejoinInvite(true, null, now), true);
});

test("ended overlay hides rejoin after expiry and during reconnect grace", () => {
  const end = "2026-09-19T13:15:00.000Z";
  const now = Date.parse(end) - 1_000;
  assert.deepEqual(endedOverlayState({ expired: true, inviteBound: true, expiresAt: end, now }), {
    show: true,
    rejoin: false,
    messageKey: "invite.sessionExpired",
  });
  assert.equal(
    endedOverlayState({ replaced: true, inviteBound: true, expiresAt: end, now }).messageKey,
    "invite.replaced",
  );
  assert.deepEqual(endedOverlayState({ transient: true }), {
    show: false,
    rejoin: false,
    messageKey: "status.reconnecting",
  });
  assert.equal(
    endedOverlayState({ inviteBound: true, expiresAt: end, now: Date.parse(end) + 1 }).rejoin,
    false,
  );
  assert.equal(
    endedOverlayState({ inviteBound: true, expiresAt: end, now }).messageKey,
    "invite.accessAgain",
  );
  const overlay = { dataset: {}, textContent: "" };
  const els = {
    btnRejoin: { classList: { hidden: true, toggle(_name, force) { this.hidden = !force; } } },
    endedOverlay: { querySelector: () => overlay },
  };
  const calls = [];
  paintCallEnded(
    { show: true, rejoin: false, messageKey: "invite.sessionExpired" },
    {
      setStatus(key) { calls.push(key); },
      showEnded(show) { calls.push(show); },
    },
    els,
    (key) => key,
  );
  assert.equal(overlay.textContent, "invite.sessionExpired");
  assert.equal(calls[0], true);
  assert.equal(calls[1], "invite.sessionExpired");
});

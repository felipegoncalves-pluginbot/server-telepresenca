import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import {
  createInviteRejoin,
  identificationRequired,
  inviteApiUrl,
  inviteIdFromSearch,
  overlayKeyForInvite,
  recalledIdentification,
  rememberIdentification,
  roomIdFromSearch,
  sessionFromJoin,
} from "../../public/js/invite/session.js";
import { showInviteMessage } from "../../public/js/invite/gate.js";
import { isExpired, parseExpiresAt } from "../../src/rooms/expiry.js";

test("invite id and API url helpers", () => {
  assert.equal(inviteIdFromSearch("?room=x&invite=abc"), "abc");
  assert.equal(inviteIdFromSearch(""), "");
  assert.equal(roomIdFromSearch("?room=x&invite=abc"), "x");
  assert.equal(roomIdFromSearch("?invite=abc"), "");
  assert.equal(inviteApiUrl("uid-1", "/join"), "/invite-session/uid-1/join");
  const store = {
    data: {},
    setItem(key, value) {
      this.data[key] = value;
    },
    getItem(key) {
      return this.data[key] || null;
    },
  };
  rememberIdentification("abc", "nome", store);
  assert.equal(recalledIdentification("abc", store), "nome");
  assert.equal(recalledIdentification("", store), "");
});

test("overlay keys follow invite HTTP codes", () => {
  assert.equal(
    overlayKeyForInvite(425, { code: "invite_not_started" }),
    "invite.notStarted",
  );
  assert.equal(overlayKeyForInvite(410, { code: "invite_ended" }), "invite.expired");
  assert.equal(
    overlayKeyForInvite(409, { code: "invite_superseded" }),
    "invite.superseded",
  );
  assert.equal(overlayKeyForInvite(404, {}), "invite.notFound");
  assert.equal(
    overlayKeyForInvite(503, { code: "invite_missing_api" }),
    "invite.missingApi",
  );
  assert.equal(overlayKeyForInvite(500, {}), "invite.unavailable");
});

test("sessionFromJoin prefers session.room and falls back to join URL", () => {
  assert.equal(
    sessionFromJoin({ session: { room: "cruzr-1", expires_at: "t" } }).roomId,
    "cruzr-1",
  );
  assert.equal(
    sessionFromJoin({
      join: { url: "http://localhost:4040/?room=cruzr-2&role=visitor" },
    }).roomId,
    "cruzr-2",
  );
  assert.equal(identificationRequired({ identification: { required: true } }), true);
  assert.equal(identificationRequired({ identification: { required: false } }), false);
});

test("createInviteRejoin skips the first connect and revalidates later", async () => {
  const first = createInviteRejoin(null);
  assert.equal(first, null);
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({ session: { room: "r1", expires_at: "t" } }),
    };
  };
  const beforeConnect = createInviteRejoin(
    { roomId: "r1" },
    { fetchImpl, search: "?invite=abc" },
  );
  assert.equal(await beforeConnect(), true);
  assert.equal(calls.length, 0);
  assert.equal(await beforeConnect(), true);
  assert.equal(calls.length, 1);
});

test("createInviteRejoin denies reconnect when the invite ended", async () => {
  let denied = "";
  const fetchImpl = async () => ({
    ok: false,
    status: 410,
    json: async () => ({ code: "invite_ended" }),
  });
  const beforeConnect = createInviteRejoin(
    { roomId: "r1" },
    {
      fetchImpl,
      search: "?invite=abc",
      onDenied: (key) => {
        denied = key;
      },
    },
  );
  await beforeConnect();
  assert.equal(await beforeConnect(), false);
  assert.equal(denied, "invite.expired");
});

test("parseExpiresAt and isExpired", () => {
  const iso = "2026-09-19T13:15:00.000Z";
  assert.equal(parseExpiresAt(iso), Date.parse(iso));
  assert.equal(isExpired(Date.parse(iso), Date.parse(iso) + 1), true);
  assert.equal(isExpired(Date.parse(iso), Date.parse(iso) - 1), false);
  assert.equal(parseExpiresAt(""), null);
});

test("showInviteMessage toggles overlay classes", () => {
  const overlayClasses = {
    force: null,
    toggle(_name, force) {
      this.force = force;
    },
  };
  const els = {
    inviteOverlay: { classList: overlayClasses },
    identifyForm: {
      classList: {
        add(name) {
          this.added = name;
        },
      },
    },
    inviteOverlayText: {
      classList: {
        remove(name) {
          this.removed = name;
        },
      },
      dataset: {},
      textContent: "",
    },
    endedOverlay: {
      classList: {
        add(name) {
          this.added = name;
        },
      },
    },
  };
  showInviteMessage(els, (key) => key, "invite.expired");
  assert.equal(overlayClasses.force, false);
  assert.equal(els.inviteOverlayText.textContent, "invite.expired");
  assert.equal(els.inviteOverlayText.dataset.i18n, "invite.expired");
});

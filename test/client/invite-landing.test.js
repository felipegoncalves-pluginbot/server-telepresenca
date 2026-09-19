import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import {
  applyInviteBranding,
  formatInviteWhen,
  invitePhase,
  paintInviteWindow,
  pluginspaceLogoUrl,
  pluginspacePrimaryColor,
} from "../../public/js/invite/landing.js";
import { runInviteGate } from "../../public/js/invite/gate.js";

function classList() {
  const names = new Set(["hidden"]);
  return {
    add(name) {
      names.add(name);
    },
    remove(name) {
      names.delete(name);
    },
    toggle(name, force) {
      if (force === true) names.add(name);
      else if (force === false) names.delete(name);
      else if (names.has(name)) names.delete(name);
      else names.add(name);
    },
    contains(name) {
      return names.has(name);
    },
  };
}

function mockEls() {
  const enterListeners = [];
  return {
    inviteOverlay: { classList: classList(), style: { setProperty() {} } },
    endedOverlay: { classList: classList() },
    identifyForm: { classList: classList(), addEventListener() {} },
    inviteOverlayText: { classList: classList(), dataset: {}, textContent: "" },
    inviteWindow: { classList: classList(), textContent: "" },
    inviteLogo: { classList: classList(), src: "" },
    inviteEnter: {
      classList: classList(),
      disabled: false,
      dataset: {},
      textContent: "",
      addEventListener(_type, fn) {
        enterListeners.push(fn);
      },
      click() {
        enterListeners.forEach((fn) => fn({ preventDefault() {} }));
      },
    },
    identifyDescription: { classList: classList(), textContent: "" },
    identifyError: { classList: classList(), textContent: "" },
    identifyInput: { value: "", focus() {} },
    enterListeners,
  };
}

function jsonOk(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

async function waitForEnterButton(els, timeoutMs = 200) {
  const started = Date.now();
  while (els.enterListeners.length === 0 && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.ok(els.enterListeners.length > 0);
}

const i18n = {
  locale: "pt-BR",
  t(key) {
    return key;
  },
  async setLocale(locale) {
    this.locale = locale;
  },
};

test("invite landing phase and pluginspace branding", () => {
  assert.equal(invitePhase({ status: "not_started" }), "soon");
  assert.equal(invitePhase({ status: "ended" }), "ended");
  assert.equal(invitePhase({ status: "open" }), "open");
  assert.equal(
    pluginspaceLogoUrl({ pluginspace: { logo: { url: "https://x/logo.png" } } }),
    "https://x/logo.png",
  );
  assert.equal(
    pluginspacePrimaryColor({ pluginspace: { theme: { primary: "#112233" } } }),
    "#112233",
  );
  assert.ok(formatInviteWhen("2026-09-19T13:00:00.000Z", "en").length > 0);
  const els = mockEls();
  applyInviteBranding(els, {
    pluginspace: { logo: { url: "https://x/logo.png" }, theme: { primary: "#112233" } },
  });
  assert.equal(els.inviteLogo.src, "https://x/logo.png");
  assert.equal(els.inviteLogo.classList.contains("hidden"), false);
  paintInviteWindow(
    els,
    {
      status: "not_started",
      start_date: "2026-09-19T13:00:00.000Z",
    },
    "en",
  );
  assert.equal(els.inviteWindow.classList.contains("hidden"), false);
  assert.ok(els.inviteWindow.textContent.length > 0);
});

test("open invite waits for Enter instead of auto-joining", async () => {
  const els = mockEls();
  const posts = [];
  const fetchImpl = async (url, options = {}) => {
    if (options.method === "POST") {
      posts.push(url);
      return jsonOk({ session: { room: "r1", expires_at: "t" } });
    }
    return jsonOk({ status: "open", locale: "pt-BR" });
  };
  const pending = runInviteGate({
    els,
    i18n,
    fetchImpl,
    search: "?invite=abc",
  });
  await waitForEnterButton(els);
  assert.equal(posts.length, 0);
  assert.equal(els.inviteOverlayText.textContent, "invite.title");
  els.inviteEnter.click();
  const session = await pending;
  assert.equal(session.roomId, "r1");
  assert.equal(posts.length, 1);
});

test("refresh with room already on the URL auto-joins", async () => {
  const els = mockEls();
  const fetchImpl = async (_url, options = {}) => {
    if (options.method === "POST") {
      return jsonOk({ session: { room: "r1", expires_at: "t" } });
    }
    return jsonOk({ status: "open" });
  };
  const session = await runInviteGate({
    els,
    i18n,
    fetchImpl,
    search: "?invite=abc&room=r1",
  });
  assert.equal(session.roomId, "r1");
  assert.equal(els.enterListeners.length, 0);
});

test("not-started invite polls until open then waits for Enter", async () => {
  const els = mockEls();
  let gets = 0;
  const fetchImpl = async (_url, options = {}) => {
    if (options.method === "POST") {
      return jsonOk({ session: { room: "r2", expires_at: "t" } });
    }
    gets += 1;
    return jsonOk({
      status: gets === 1 ? "not_started" : "open",
      start_date: "2026-09-19T13:00:00.000Z",
    });
  };
  const pending = runInviteGate({
    els,
    i18n,
    fetchImpl,
    search: "?invite=abc",
    pollMs: 5,
  });
  await waitForEnterButton(els);
  assert.ok(gets >= 2);
  els.inviteEnter.click();
  const session = await pending;
  assert.equal(session.roomId, "r2");
  assert.ok(gets >= 2);
});

test("ended invite shows the expired landing", async () => {
  const els = mockEls();
  const session = await runInviteGate({
    els,
    i18n,
    fetchImpl: async () => jsonOk({ status: "ended" }),
    search: "?invite=abc",
  });
  assert.equal(session, false);
  assert.equal(els.inviteOverlayText.textContent, "invite.expired");
});

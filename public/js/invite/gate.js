import {
  applyInviteBranding,
  invitePhase,
  paintInviteWindow,
} from "./landing.js";
import {
  createInviteRejoin,
  fetchInvite,
  identificationRequired,
  inviteIdFromSearch,
  joinInvite,
  overlayKeyForInvite,
  recalledIdentification,
  rememberIdentification,
  roomIdFromSearch,
  sessionFromJoin,
} from "./session.js";

export { createInviteRejoin };

const POLL_MS = 5_000;

/**
 * @param {ReturnType<import("../ui/dom.js").queryDom>} els
 * @param {boolean} show
 */
export function setInviteOverlayOpen(els, show) {
  if (!els.inviteOverlay) return;
  els.inviteOverlay.classList.toggle("hidden", !show);
  if (els.endedOverlay && show) els.endedOverlay.classList.add("hidden");
}

/**
 * @param {ReturnType<import("../ui/dom.js").queryDom>} els
 * @param {(key: string) => string} t
 * @param {string} key
 */
export function showInviteMessage(els, t, key) {
  setInviteOverlayOpen(els, true);
  if (els.identifyForm) els.identifyForm.classList.add("hidden");
  if (els.inviteEnter) els.inviteEnter.classList.add("hidden");
  if (els.inviteWindow) els.inviteWindow.classList.add("hidden");
  if (els.inviteOverlayText) {
    els.inviteOverlayText.dataset.i18n = key;
    els.inviteOverlayText.textContent = t(key);
    els.inviteOverlayText.classList.remove("hidden");
  }
}

/**
 * @param {object} invite
 * @param {ReturnType<import("../ui/dom.js").queryDom>} els
 * @param {(key: string) => string} t
 */
export function showIdentifyForm(invite, els) {
  const ident = invite.identification || {};
  const hint = ident.description || ident.text || "";
  if (els.identifyDescription) {
    els.identifyDescription.textContent = hint;
    els.identifyDescription.classList.toggle("hidden", !hint);
  }
  if (els.identifyError) els.identifyError.classList.add("hidden");
  if (els.identifyForm) els.identifyForm.classList.remove("hidden");
  if (els.identifyInput) {
    els.identifyInput.value = els.identifyInput.value || "";
    els.identifyInput.focus();
  }
}

/**
 * @param {ReturnType<import("../ui/dom.js").queryDom>} els
 * @param {(key: string, vars?: object) => string} t
 * @param {object} invite
 * @param {string} locale
 */
function showInviteSoon(els, t, invite, locale) {
  setInviteOverlayOpen(els, true);
  applyInviteBranding(els, invite);
  if (els.identifyForm) els.identifyForm.classList.add("hidden");
  if (els.inviteEnter) els.inviteEnter.classList.add("hidden");
  if (els.inviteOverlayText) {
    els.inviteOverlayText.dataset.i18n = "invite.soon";
    els.inviteOverlayText.textContent = t("invite.soon");
    els.inviteOverlayText.classList.remove("hidden");
  }
  paintInviteWindow(els, invite, locale);
}

/**
 * @param {ReturnType<import("../ui/dom.js").queryDom>} els
 * @param {(key: string, vars?: object) => string} t
 * @param {object} invite
 * @param {string} locale
 */
function showOpenLanding(els, t, invite, locale) {
  setInviteOverlayOpen(els, true);
  applyInviteBranding(els, invite);
  if (els.inviteOverlayText) {
    els.inviteOverlayText.dataset.i18n = "invite.title";
    els.inviteOverlayText.textContent = t("invite.title");
    els.inviteOverlayText.classList.remove("hidden");
  }
  paintInviteWindow(els, invite, locale);
  if (identificationRequired(invite)) {
    showIdentifyForm(invite, els);
  } else if (els.identifyForm) {
    els.identifyForm.classList.add("hidden");
  }
  if (els.inviteEnter) {
    els.inviteEnter.disabled = false;
    els.inviteEnter.dataset.i18n = "invite.enter";
    els.inviteEnter.textContent = t("invite.enter");
    els.inviteEnter.classList.remove("hidden");
  }
}

/**
 * @param {string} roomId
 */
export function stampRoomOnUrl(roomId) {
  if (!roomId || typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  url.searchParams.set("role", "visitor");
  window.history.replaceState({}, "", url);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * @param {object} options
 */
async function waitUntilOpen(options) {
  const { els, t, i18n, invite, inviteId, fetchImpl, intervalMs = POLL_MS } = options;
  let current = invite;
  showInviteSoon(els, t, current, i18n.locale);
  while (invitePhase(current) === "soon") {
    await delay(intervalMs);
    const shown = await fetchInvite(inviteId, fetchImpl);
    if (!shown.ok) {
      showInviteMessage(els, t, overlayKeyForInvite(shown.status, shown.body));
      return false;
    }
    current = shown.body;
    if (current.locale) await i18n.setLocale(current.locale);
    applyInviteBranding(els, current);
    if (invitePhase(current) === "ended") {
      showInviteMessage(els, t, "invite.expired");
      return false;
    }
    if (invitePhase(current) === "soon") {
      showInviteSoon(els, t, current, i18n.locale);
    }
  }
  return current;
}

/**
 * @param {object} options
 */
function waitForEnter(options) {
  const { els, t, i18n, invite, inviteId, fetchImpl } = options;
  showOpenLanding(els, t, invite, i18n.locale);
  return new Promise((resolve) => {
    let busy = false;
    const joinNow = async () => {
      if (busy) return;
      busy = true;
      if (els.inviteEnter) {
        els.inviteEnter.disabled = true;
        els.inviteEnter.textContent = t("invite.joining");
      }
      const value = els.identifyInput ? els.identifyInput.value : "";
      const joined = await completeJoin({
        els,
        t,
        inviteId,
        identification: value,
        fetchImpl,
        keepFormOnError: true,
      });
      if (joined) {
        resolve(joined);
        return;
      }
      busy = false;
      if (els.inviteEnter) {
        els.inviteEnter.disabled = false;
        els.inviteEnter.textContent = t("invite.enter");
      }
    };
    if (els.inviteEnter) {
      els.inviteEnter.addEventListener("click", (event) => {
        event.preventDefault();
        joinNow();
      });
    }
    if (els.identifyForm) {
      els.identifyForm.addEventListener("submit", (event) => {
        event.preventDefault();
        joinNow();
      });
    }
  });
}

/**
 * @param {object} options
 * @param {ReturnType<import("../ui/dom.js").queryDom>} options.els
 * @param {import("../i18n/index.js").i18n} options.i18n
 * @param {typeof fetch} [options.fetchImpl]
 * @param {string} [options.search]
 */
export async function runInviteGate({
  els,
  i18n,
  fetchImpl = fetch,
  search = typeof window !== "undefined" ? window.location.search : "",
  pollMs = POLL_MS,
}) {
  const t = (key, vars) => i18n.t(key, vars);
  const inviteId = inviteIdFromSearch(search);
  if (!inviteId) return null;

  const shown = await fetchInvite(inviteId, fetchImpl);
  if (!shown.ok) {
    showInviteMessage(els, t, overlayKeyForInvite(shown.status, shown.body));
    return false;
  }

  let invite = shown.body;
  if (invite.locale) await i18n.setLocale(invite.locale);
  applyInviteBranding(els, invite);

  const phase = invitePhase(invite);
  if (phase === "ended") {
    showInviteMessage(els, t, "invite.expired");
    return false;
  }
  if (phase === "soon") {
    invite = await waitUntilOpen({
      els,
      t,
      i18n,
      invite,
      inviteId,
      fetchImpl,
      intervalMs: pollMs,
    });
    if (!invite) return false;
  }

  if (roomIdFromSearch(search)) {
    return completeJoin({
      els,
      t,
      inviteId,
      identification: recalledIdentification(inviteId),
      fetchImpl,
    });
  }

  return waitForEnter({ els, t, i18n, invite, inviteId, fetchImpl });
}

/**
 * @param {object} options
 */
async function completeJoin({
  els,
  t,
  inviteId,
  identification,
  fetchImpl,
  keepFormOnError = false,
}) {
  const joined = await joinInvite(inviteId, identification, fetchImpl);
  if (!joined.ok) {
    if (keepFormOnError && joined.body.code === "invalid_identification") {
      if (els.identifyError) {
        els.identifyError.textContent = t("invite.identifyError");
        els.identifyError.classList.remove("hidden");
      }
      return null;
    }
    showInviteMessage(els, t, overlayKeyForInvite(joined.status, joined.body));
    return false;
  }
  const session = sessionFromJoin(joined.body);
  if (!session.roomId) {
    showInviteMessage(els, t, "invite.unavailable");
    return false;
  }
  rememberIdentification(inviteId, identification);
  stampRoomOnUrl(session.roomId);
  setInviteOverlayOpen(els, false);
  return session;
}

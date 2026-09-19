import {
  createInviteRejoin,
  fetchInvite,
  identificationRequired,
  inviteIdFromSearch,
  joinInvite,
  overlayKeyForInvite,
  sessionFromJoin,
} from "./session.js";

export { createInviteRejoin };

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
export function showIdentifyForm(invite, els, t) {
  setInviteOverlayOpen(els, true);
  const ident = invite.identification || {};
  if (els.inviteOverlayText) {
    els.inviteOverlayText.dataset.i18n = "invite.identifyTitle";
    els.inviteOverlayText.textContent = ident.text || t("invite.identifyTitle");
    els.inviteOverlayText.classList.remove("hidden");
  }
  if (els.identifyDescription) {
    els.identifyDescription.textContent = ident.description || "";
    els.identifyDescription.classList.toggle("hidden", !ident.description);
  }
  if (els.identifyError) els.identifyError.classList.add("hidden");
  if (els.identifyForm) els.identifyForm.classList.remove("hidden");
  if (els.identifyInput) {
    els.identifyInput.value = "";
    els.identifyInput.focus();
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
}) {
  const t = (key) => i18n.t(key);
  const inviteId = inviteIdFromSearch(search);
  if (!inviteId) return null;

  const shown = await fetchInvite(inviteId, fetchImpl);
  if (!shown.ok) {
    showInviteMessage(els, t, overlayKeyForInvite(shown.status, shown.body));
    return false;
  }

  const invite = shown.body;
  if (invite.locale) await i18n.setLocale(invite.locale);

  if (identificationRequired(invite)) {
    return waitForIdentification({ els, t, inviteId, fetchImpl, invite });
  }

  return completeJoin({ els, t, inviteId, identification: "", fetchImpl });
}

/**
 * @param {object} options
 */
function waitForIdentification({ els, t, inviteId, fetchImpl, invite }) {
  showIdentifyForm(invite, els, t);
  return new Promise((resolve) => {
    const form = els.identifyForm;
    if (!form) {
      showInviteMessage(els, t, "invite.unavailable");
      resolve(false);
      return;
    }
    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        const value = els.identifyInput ? els.identifyInput.value : "";
        const joined = await completeJoin({
          els,
          t,
          inviteId,
          identification: value,
          fetchImpl,
          keepFormOnError: true,
        });
        if (joined) resolve(joined);
      },
      { once: false },
    );
  });
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
  stampRoomOnUrl(session.roomId);
  setInviteOverlayOpen(els, false);
  return session;
}

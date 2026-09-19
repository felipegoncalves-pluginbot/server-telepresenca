/** LiveKit departureTimeout default: 20s of silence before the session is gone. */
export const RECONNECT_GRACE_MS = 20_000;

/**
 * Socket.IO auto-reconnects on transport failures, not on explicit server/client disconnect.
 * @param {string | undefined} reason
 */
export function isTransientDisconnect(reason) {
  return reason !== "io server disconnect" && reason !== "io client disconnect";
}

/**
 * @param {boolean} inviteBound
 * @param {unknown} expiresAt
 * @param {number} [now]
 */
export function canRejoinInvite(inviteBound, expiresAt, now = Date.now()) {
  if (!inviteBound) return true;
  if (expiresAt == null || expiresAt === "") return true;
  const end = Date.parse(String(expiresAt));
  if (!Number.isFinite(end)) return true;
  return now < end;
}

/**
 * @param {object} options
 * @param {boolean} [options.expired]
 * @param {boolean} [options.replaced]
 * @param {boolean} [options.transient]
 * @param {boolean} [options.inviteBound]
 * @param {unknown} [options.expiresAt]
 * @param {number} [options.now]
 */
export function endedOverlayState({
  expired = false,
  replaced = false,
  transient = false,
  inviteBound = false,
  expiresAt = null,
  now = Date.now(),
} = {}) {
  if (expired) {
    return { show: true, rejoin: false, messageKey: "invite.sessionExpired" };
  }
  if (replaced) {
    return {
      show: true,
      rejoin: canRejoinInvite(inviteBound, expiresAt, now),
      messageKey: "invite.replaced",
    };
  }
  if (transient) {
    return { show: false, rejoin: false, messageKey: "status.reconnecting" };
  }
  return {
    show: true,
    rejoin: canRejoinInvite(inviteBound, expiresAt, now),
    messageKey: inviteBound ? "invite.accessAgain" : "call.ended",
  };
}

/**
 * @param {ReturnType<typeof endedOverlayState>} state
 * @param {{ setStatus: Function, showEnded: Function }} status
 * @param {{ btnRejoin?: { classList: { toggle: Function } }, endedOverlay?: { querySelector: Function } }} els
 * @param {(key: string) => string} t
 */
export function paintCallEnded(state, status, els, t) {
  if (!state.show) {
    status.setStatus(state.messageKey, "");
    status.showEnded(false);
    return;
  }
  status.showEnded(true);
  if (els.btnRejoin) els.btnRejoin.classList.toggle("hidden", !state.rejoin);
  const text = els.endedOverlay && els.endedOverlay.querySelector("p");
  if (text) {
    text.dataset.i18n = state.messageKey;
    text.textContent = t(state.messageKey);
  }
  const key = state.messageKey === "call.ended" ? "status.disconnected" : state.messageKey;
  status.setStatus(key, "");
}

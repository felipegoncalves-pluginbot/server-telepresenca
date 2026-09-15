const RTC_I18N = {
  idle: "rtc.idle",
  connecting: "rtc.connecting",
  connected: "rtc.connected",
  disconnected: "rtc.disconnected",
  failed: "rtc.failed",
  error: "rtc.error",
};

/**
 * @param {object} els
 * @param {(key: string, vars?: object) => string} t
 */
export function createStatus(els, t) {
  function setPlaceholder(key) {
    if (!els.placeholderText) return;
    els.placeholderText.dataset.i18n = key;
    els.placeholderText.textContent = t(key);
  }

  function setStatus(key, mode = "") {
    els.statusChip.textContent = t(key);
    els.statusChip.dataset.i18n = key;
    els.statusChip.className = `status-chip ${mode}`.trim();
  }

  function setRtcState(state) {
    els.statusChip.dataset.rtc = state || "";
    const key = RTC_I18N[state];
    if (!key) {
      els.statusChip.removeAttribute("title");
      return;
    }
    els.statusChip.title = t(key);
  }

  function showEnded(show) {
    els.endedOverlay.classList.toggle("hidden", !show);
  }

  return { setPlaceholder, setStatus, setRtcState, showEnded };
}

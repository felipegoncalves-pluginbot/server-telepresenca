const MINUTE = 60 * 1000;

/**
 * @param {unknown} expiresAt
 * @param {number} [now]
 * @returns {number | null}
 */
export function remainingMs(expiresAt, now = Date.now()) {
  if (expiresAt == null || expiresAt === "") return null;
  const end = Date.parse(String(expiresAt));
  if (!Number.isFinite(end)) return null;
  return end - now;
}

/**
 * @param {number | null} ms
 */
export function urgencyForRemaining(ms) {
  if (ms == null) return "idle";
  if (ms <= 0) return "ended";
  if (ms <= MINUTE) return "critical";
  if (ms <= 5 * MINUTE) return "warn";
  return "ok";
}

/**
 * Compact remaining time: `12:04` or `1:02:03`.
 * @param {number | null} ms
 */
export function formatRemaining(ms) {
  if (ms == null) return "";
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${minutes}:${ss}`;
}

/**
 * Discreet HUD countdown. Hidden when the session has no expiry (RC3 live calls).
 * @param {object} options
 * @param {ReturnType<import("../ui/dom.js").queryDom>} options.els
 * @param {(key: string, vars?: object) => string} options.t
 * @param {unknown} [options.expiresAt]
 * @param {() => void} [options.onExpired]
 * @param {() => number} [options.now]
 * @param {number} [options.intervalMs]
 */
export function createSessionCountdown({
  els,
  t,
  expiresAt = null,
  onExpired = null,
  now = () => Date.now(),
  intervalMs = 1000,
}) {
  let timer = null;
  let expiredNotified = false;

  function hide() {
    if (!els.sessionCountdown) return;
    els.sessionCountdown.hidden = true;
    els.sessionCountdown.textContent = "";
    els.sessionCountdown.removeAttribute("data-urgency");
  }

  function paint() {
    const el = els.sessionCountdown;
    if (!el) return urgencyForRemaining(remainingMs(expiresAt, now()));
    const ms = remainingMs(expiresAt, now());
    const urgency = urgencyForRemaining(ms);
    if (ms == null) {
      hide();
      return urgency;
    }
    const label = formatRemaining(ms);
    el.hidden = false;
    el.textContent = label;
    el.dataset.urgency = urgency;
    const caption = t("invite.timeLeft", { time: label });
    el.title = caption;
    el.setAttribute("aria-label", caption);
    return urgency;
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    stop();
    expiredNotified = false;
    if (!expiresAt) {
      hide();
      return;
    }
    const urgency = paint();
    if (urgency === "ended") {
      if (!expiredNotified) {
        expiredNotified = true;
        if (typeof onExpired === "function") onExpired();
      }
      return;
    }
    timer = setInterval(() => {
      if (paint() === "ended") {
        stop();
        if (!expiredNotified) {
          expiredNotified = true;
          if (typeof onExpired === "function") onExpired();
        }
      }
    }, intervalMs);
  }

  return { start, stop, hide, paint };
}

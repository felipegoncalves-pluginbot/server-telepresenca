import { createHeadLookSurface } from "../head-look.js";
import {
  addLook,
  LOOK_KEY_RATE,
  lookKeyDelta,
  parseLookValue,
} from "../protocol/look.js";
import { headAxes, isHeadAvailable } from "../protocol/capabilities.js";

const SEND_MS = 50;
const KEY_TICK_MS = 50;

/**
 * @param {object} els
 * @param {(key: string, vars?: object) => string} t
 */
export function createHeadFeature(els, t) {
  let caps = null;
  let pose = { yaw: 0, pitch: 0 };
  let surface = null;
  /** @type {import("./registry.js").FeatureContext | null} */
  let ctx = null;
  /** @type {Set<string>} */
  const held = new Set();
  let keyTimer = null;
  let sendTimer = null;
  let pending = false;
  let reducedMotion = false;

  function axes() {
    return headAxes(caps);
  }

  function setHostHidden(hidden) {
    if (els.headHost) els.headHost.hidden = hidden;
    if (els.headLookLayer) els.headLookLayer.hidden = hidden;
  }

  function setKeyFeedback(key, on) {
    if (!els.headKbdHint) return;
    const cap = els.headKbdHint.querySelector(`[data-key="${key}"]`);
    if (cap) cap.classList.toggle("is-active", on);
  }

  function applyPreview(preview) {
    const video = els.remoteVideo;
    if (!video) return;
    if (!preview || reducedMotion) {
      video.classList.remove("is-look-preview");
      video.style.transform = "";
      return;
    }
    video.classList.add("is-look-preview");
    video.style.transform = `translate(${preview.x}px, ${preview.y}px)`;
  }

  function markUsed() {
    if (els.headLookLayer) els.headLookLayer.classList.add("has-looked");
  }

  function flushLook(force) {
    if (!ctx?.isConnected()) return;
    if (!pending && !force) return;
    pending = false;
    ctx.sendControl("head.look", parseLookValue(pose), { volatile: true });
  }

  function scheduleSend() {
    pending = true;
    if (sendTimer) return;
    sendTimer = setTimeout(() => {
      sendTimer = null;
      flushLook(false);
    }, SEND_MS);
  }

  function setPose(next, send) {
    pose = parseLookValue(next);
    if (send) scheduleSend();
  }

  function applyDelta(delta) {
    setPose(addLook(pose, delta, axes()), true);
    markUsed();
  }

  function resetLook() {
    pose = { yaw: 0, pitch: 0 };
    pending = false;
    if (sendTimer) {
      clearTimeout(sendTimer);
      sendTimer = null;
    }
    applyPreview(null);
    if (ctx?.isConnected())
      ctx.sendControl("head.reset", undefined, { volatile: false });
  }

  function tickKeys() {
    if (!held.size || !ctx?.isConnected()) return;
    const step = (LOOK_KEY_RATE * KEY_TICK_MS) / 1000;
    let yaw = 0;
    let pitch = 0;
    const on = axes();
    for (const key of held) {
      const dir = lookKeyDelta(key);
      if (!dir) continue;
      if (on.yaw) yaw += dir.yaw;
      if (on.pitch) pitch += dir.pitch;
    }
    if (yaw === 0 && pitch === 0) return;
    applyDelta({ yaw: yaw * step, pitch: pitch * step });
  }

  function stopKeys() {
    if (keyTimer) {
      clearInterval(keyTimer);
      keyTimer = null;
    }
    for (const key of held) setKeyFeedback(key, false);
    held.clear();
  }

  function typingTarget() {
    const tag = document.activeElement
      ? document.activeElement.tagName.toLowerCase()
      : "";
    return tag === "input" || tag === "textarea";
  }

  function onKeyDown(event) {
    if (!ctx?.isConnected() || typingTarget()) return;
    const key = event.key.toLowerCase();
    if (key === "home") {
      event.preventDefault();
      resetLook();
      return;
    }
    if (!lookKeyDelta(key) || event.repeat) return;
    const on = axes();
    if ((key === "j" || key === "l") && !on.yaw) return;
    if ((key === "i" || key === "k") && !on.pitch) return;
    event.preventDefault();
    held.add(key);
    setKeyFeedback(key, true);
    if (!keyTimer) keyTimer = setInterval(tickKeys, KEY_TICK_MS);
    tickKeys();
  }

  function onKeyUp(event) {
    const key = event.key.toLowerCase();
    if (!held.has(key)) return;
    event.preventDefault();
    held.delete(key);
    setKeyFeedback(key, false);
    if (!held.size) stopKeys();
    flushLook(true);
  }

  function setEnabled(enabled) {
    if (surface) surface.setEnabled(enabled);
    if (!enabled) {
      stopKeys();
      applyPreview(null);
    }
  }

  return {
    id: "head",
    optIn: true,
    isAvailable: isHeadAvailable,
    /**
     * @param {import("./registry.js").FeatureContext} nextCtx
     */
    mount(nextCtx) {
      ctx = nextCtx;
      caps = nextCtx.caps;
      pose = { yaw: 0, pitch: 0 };
      reducedMotion = Boolean(
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
      setHostHidden(false);
      if (els.headLookLayer) {
        surface = createHeadLookSurface(els.headLookLayer, {
          onDelta: applyDelta,
          onReset: resetLook,
          onPreview: applyPreview,
        });
        surface.setAxes(axes());
        surface.setEnabled(nextCtx.isConnected());
      }
      const onBlur = () => {
        stopKeys();
        flushLook(true);
        applyPreview(null);
      };
      window.addEventListener("blur", onBlur);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      return () => {
        stopKeys();
        if (sendTimer) clearTimeout(sendTimer);
        sendTimer = null;
        window.removeEventListener("blur", onBlur);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        if (surface) {
          surface.destroy();
          surface = null;
        }
        applyPreview(null);
        setHostHidden(true);
        ctx = null;
      };
    },
    update(nextCaps, nextCtx) {
      caps = nextCaps;
      ctx = nextCtx;
      if (surface) surface.setAxes(axes());
      setHostHidden(!isHeadAvailable(nextCaps));
    },
    setEnabled,
    refreshLabels() {
      if (els.headLookLayer) {
        els.headLookLayer.setAttribute("aria-label", t("head.layer"));
        els.headLookLayer.title = t("head.hintKeyboard");
      }
      if (els.headKbdHint) {
        els.headKbdHint.setAttribute("aria-label", t("head.hintKeyboard"));
      }
      if (els.headHint) els.headHint.textContent = t("head.look");
    },
  };
}

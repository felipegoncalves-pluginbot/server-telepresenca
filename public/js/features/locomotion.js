import { createTeleJoystick } from "../joystick.js";
import {
  backwardPulseDistanceM,
  isContinuousBackward,
  isLocomotionAvailable,
} from "../protocol/capabilities.js";

const MOVEMENT_I18N = {
  forward: "movement.forward",
  backward: "movement.backward",
  left: "movement.left",
  right: "movement.right",
  stop: "movement.stop",
};

const KEY_FEEDBACK = {
  w: "w",
  arrowup: "w",
  a: "a",
  arrowleft: "a",
  s: "s",
  arrowdown: "s",
  d: "d",
  arrowright: "d",
};

/**
 * @param {object} els
 * @param {(key: string, vars?: object) => string} t
 */
export function createLocomotionFeature(els, t) {
  let caps = null;
  let joystick = null;
  let activeMovement = null;
  let movementHeartbeat = null;
  /** @type {import("./registry.js").FeatureContext | null} */
  let ctx = null;

  function setHostHidden(hidden) {
    if (els.locomotionHost) els.locomotionHost.hidden = hidden;
  }

  function updateMovementHint() {
    if (!els.movementHint) return;
    if (isContinuousBackward(caps)) {
      els.movementHint.textContent = t("movement.hintContinuous");
      return;
    }
    const dist = backwardPulseDistanceM(caps);
    els.movementHint.textContent = t("movement.hintPulse", {
      cm: Math.round(dist * 100),
    });
  }

  function setKeyFeedback(key, on) {
    const mapped = KEY_FEEDBACK[key];
    if (!mapped || !els.kbdHint) return;
    const cap = els.kbdHint.querySelector(`[data-key="${mapped}"]`);
    if (cap) cap.classList.toggle("is-active", on);
  }

  function sendControl(action, opts) {
    if (!ctx) return;
    ctx.sendControl(action, undefined, opts);
  }

  function startMovement(action) {
    if (!action || !ctx?.isConnected()) return;

    if (action === "backward" && !isContinuousBackward(caps)) {
      sendControl("backward", { volatile: true });
      return;
    }

    if (activeMovement === action) return;

    stopMovement(false);
    activeMovement = action;
    sendControl(action, { volatile: true });

    movementHeartbeat = setInterval(() => {
      if (activeMovement && ctx?.isConnected()) {
        sendControl(activeMovement, { volatile: true });
      } else {
        clearInterval(movementHeartbeat);
        movementHeartbeat = null;
      }
    }, 200);
  }

  function stopMovement(sendStop = true) {
    if (movementHeartbeat) {
      clearInterval(movementHeartbeat);
      movementHeartbeat = null;
    }
    if (activeMovement) {
      activeMovement = null;
      if (sendStop && ctx?.isConnected()) {
        sendControl("stop", { volatile: true });
      }
    }
  }

  function setEnabled(enabled) {
    if (joystick) joystick.setEnabled(enabled);
  }

  function onKeyDown(event) {
    if (!ctx?.isConnected()) return;
    const tag = document.activeElement
      ? document.activeElement.tagName.toLowerCase()
      : "";
    if (tag === "input" || tag === "textarea") return;
    if (event.repeat) return;

    const key = event.key.toLowerCase();
    let action = null;

    if (key === "arrowup" || key === "w") action = "forward";
    else if (key === "arrowdown" || key === "s") action = "backward";
    else if (key === "arrowleft" || key === "a") action = "left";
    else if (key === "arrowright" || key === "d") action = "right";
    else if (key === " " || key === "escape") {
      event.preventDefault();
      stopMovement(true);
      return;
    }

    if (action) {
      event.preventDefault();
      setKeyFeedback(key, true);
      startMovement(action);
    }
  }

  function onKeyUp(event) {
    if (!ctx?.isConnected()) return;
    const key = event.key.toLowerCase();
    if (key === "arrowdown" || key === "s") {
      if (!isContinuousBackward(caps)) return;
    }
    const movementKeys = [
      "w",
      "s",
      "a",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
    ];
    if (movementKeys.includes(key)) {
      event.preventDefault();
      setKeyFeedback(key, false);
      stopMovement(true);
    }
  }

  return {
    id: "locomotion",
    optIn: false,
    isAvailable: isLocomotionAvailable,
    /**
     * @param {import("./registry.js").FeatureContext} nextCtx
     */
    mount(nextCtx) {
      ctx = nextCtx;
      caps = nextCtx.caps;
      setHostHidden(false);
      updateMovementHint();

      joystick = createTeleJoystick(els.joystick, {
        onDirection(action) {
          startMovement(action);
          els.joystick.setAttribute(
            "aria-valuetext",
            t(MOVEMENT_I18N[action] || MOVEMENT_I18N.stop),
          );
        },
        onEnd() {
          stopMovement(true);
          els.joystick.setAttribute("aria-valuetext", t(MOVEMENT_I18N.stop));
        },
      });
      joystick.setEnabled(nextCtx.isConnected());

      const onBlur = () => stopMovement(true);
      window.addEventListener("blur", onBlur);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);

      return () => {
        stopMovement(true);
        window.removeEventListener("blur", onBlur);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        if (joystick) {
          joystick.destroy();
          joystick = null;
        }
        setHostHidden(true);
        ctx = null;
      };
    },
    update(nextCaps, nextCtx) {
      caps = nextCaps;
      ctx = nextCtx;
      updateMovementHint();
      setHostHidden(!isLocomotionAvailable(nextCaps));
    },
    setEnabled,
    stopMovement,
    updateMovementHint,
    refreshLabels() {
      if (els.joystick) {
        els.joystick.setAttribute("aria-label", t("movement.joystick"));
        els.joystick.title = t("movement.hintKeyboard");
      }
      if (els.kbdHint) {
        els.kbdHint.setAttribute("aria-label", t("movement.hintKeyboard"));
      }
      updateMovementHint();
    },
  };
}

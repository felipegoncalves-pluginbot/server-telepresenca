import { isBeepAvailable } from "../protocol/capabilities.js";

const RING_TIMEOUT_MS = 30000;
const CADENCE_BURST_MS = 400;
const CADENCE_PAUSE_MS = 150;
const CADENCE_LONG_PAUSE_MS = 1800;

class RingAudioFeedback {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    /** @type {number | NodeJS.Timeout | null} */
    this.timer = null;
    this.active = false;
  }

  ensureContext() {
    if (
      !this.ctx &&
      typeof window !== "undefined" &&
      (window.AudioContext || window.webkitAudioContext)
    ) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playBurst(durationMs) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(440, now);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.03);
      gain.gain.setValueAtTime(0.05, now + durationMs / 1000 - 0.03);
      gain.gain.linearRampToValueAtTime(0.001, now + durationMs / 1000);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + durationMs / 1000);
      osc2.stop(now + durationMs / 1000);
    } catch {
      // Ignora falhas se Web Audio não for permitido ou estiver suspenso
    }
  }

  start() {
    if (this.active) return;
    this.active = true;

    const scheduleCadence = () => {
      if (!this.active) return;
      this.playBurst(CADENCE_BURST_MS);
      this.timer = setTimeout(() => {
        if (!this.active) return;
        this.timer = setTimeout(() => {
          if (!this.active) return;
          this.playBurst(CADENCE_BURST_MS);
          this.timer = setTimeout(() => {
            if (!this.active) return;
            this.timer = setTimeout(scheduleCadence, CADENCE_LONG_PAUSE_MS);
          }, CADENCE_BURST_MS);
        }, CADENCE_PAUSE_MS);
      }, CADENCE_BURST_MS);
    };

    scheduleCadence();
  }

  stop() {
    this.active = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

let isRingingState = false;
/** @type {number | NodeJS.Timeout | null} */
let watchdogTimer = null;
/** @type {HTMLElement | null} */
let currentButton = null;
/** @type {import("./registry.js").FeatureContext | null} */
let currentCtx = null;
const audioFeedback = new RingAudioFeedback();

function updateButtonState() {
  if (!currentButton) return;
  const labelKey = isRingingState ? "media.ringStop" : "media.ringStart";
  const label =
    currentCtx && typeof currentCtx.t === "function"
      ? currentCtx.t(labelKey) || currentCtx.t("media.beep")
      : isRingingState
        ? "Parar chamada"
        : "Tocar chamada no robô";

  currentButton.setAttribute("aria-label", label);
  currentButton.setAttribute("aria-pressed", isRingingState ? "true" : "false");

  if (isRingingState) {
    currentButton.classList.add("is-ringing");
  } else {
    currentButton.classList.remove("is-ringing");
  }
}

function stopRinging(notifyRobot = true) {
  if (!isRingingState) return;
  isRingingState = false;

  if (watchdogTimer) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
  audioFeedback.stop();
  updateButtonState();

  if (
    notifyRobot &&
    currentCtx &&
    typeof currentCtx.isConnected === "function" &&
    currentCtx.isConnected()
  ) {
    currentCtx.sendControl("ring.stop");
  }
}

function startRinging() {
  if (isRingingState) return;
  if (
    !currentCtx ||
    typeof currentCtx.isConnected !== "function" ||
    !currentCtx.isConnected()
  ) {
    return;
  }

  isRingingState = true;
  updateButtonState();
  currentCtx.sendControl("ring.start");
  audioFeedback.start();

  if (watchdogTimer) clearTimeout(watchdogTimer);
  watchdogTimer = setTimeout(() => {
    stopRinging(true);
  }, RING_TIMEOUT_MS);
}

function toggleRinging() {
  if (isRingingState) {
    stopRinging(true);
  } else {
    startRinging();
  }
}

export const beepFeature = {
  id: "beep",
  optIn: false,
  isAvailable: isBeepAvailable,
  /**
   * @param {import("./registry.js").FeatureContext} ctx
   */
  mount(ctx) {
    currentCtx = ctx;
    currentButton = document.getElementById("btnSendCommand");
    if (!currentButton) return () => {};

    currentButton.hidden = false;
    updateButtonState();

    const onClick = (e) => {
      if (e && typeof e.preventDefault === "function") {
        e.preventDefault();
      }
      if (currentButton?.disabled || !ctx.isConnected()) return;
      toggleRinging();
    };

    currentButton.addEventListener("click", onClick);

    return () => {
      stopRinging(false);
      if (currentButton) {
        currentButton.removeEventListener("click", onClick);
        currentButton.hidden = true;
      }
      currentButton = null;
      currentCtx = null;
    };
  },
  /**
   * @param {object | null} caps
   */
  update(caps) {
    const button = document.getElementById("btnSendCommand");
    if (!button) return;
    button.hidden = !isBeepAvailable(caps);
  },
  refreshLabels() {
    updateButtonState();
  },
  setEnabled(enabled) {
    if (!enabled && isRingingState) {
      stopRinging(false);
    }
  },
  isRinging() {
    return isRingingState;
  },
  stop() {
    stopRinging(true);
  },
};

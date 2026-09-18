import { isVolumeAvailable, volumeRange } from "../protocol/capabilities.js";
import { parseRobotStatus, parseVolumeLevel } from "../protocol/status.js";

const ICON = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M4.5 9.5h3.2L12 6.2v11.6L7.7 14.5H4.5V9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M15.2 9.2a4.2 4.2 0 0 1 0 5.6M17.6 7a7.2 7.2 0 0 1 0 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

/**
 * @param {object} els
 * @param {(key: string, vars?: object) => string} t
 */
export function createVolumeFeature(els, t) {
  /** @type {import("./registry.js").FeatureContext | null} */
  let ctx = null;
  let root = null;
  let button = null;
  let slider = null;
  let valueEl = null;
  let panel = null;
  let min = 0;
  let max = 10;
  let level = 5;
  let sendTimer = null;

  function label() {
    return t("volume.level", { level });
  }

  function syncUi() {
    if (slider) {
      slider.min = String(min);
      slider.max = String(max);
      slider.value = String(level);
    }
    if (valueEl) valueEl.textContent = String(level);
    if (button) {
      button.setAttribute("aria-label", label());
      button.title = label();
      button.disabled = !ctx?.isConnected();
    }
    if (panel) panel.setAttribute("aria-label", t("volume.panel"));
  }

  function applyRangeFromCaps(caps) {
    const range = volumeRange(caps);
    min = range.min;
    max = range.max;
    const advertised = caps?.audio?.volumeLevel;
    level = parseVolumeLevel(
      typeof advertised === "number" ? advertised : level,
      min,
      max,
      min,
    );
  }

  function sendLevel(volatile) {
    if (!ctx?.isConnected()) return;
    ctx.sendControl("volume.set", { level }, { volatile: Boolean(volatile) });
  }

  function setLevel(next, send) {
    level = parseVolumeLevel(next, min, max, level);
    syncUi();
    if (!send) return;
    if (sendTimer) clearTimeout(sendTimer);
    sendTimer = setTimeout(() => {
      sendTimer = null;
      sendLevel(true);
    }, 80);
  }

  function setPanelOpen(open) {
    if (!panel || !button) return;
    panel.classList.toggle("hidden", !open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
  }

  return {
    id: "volume",
    optIn: true,
    isAvailable: isVolumeAvailable,
    /**
     * @param {import("./registry.js").FeatureContext} nextCtx
     */
    mount(nextCtx) {
      ctx = nextCtx;
      applyRangeFromCaps(nextCtx.caps);
      const host = nextCtx.host("volume") || els.volumeHost;
      if (!host) return () => {};
      host.hidden = false;

      root = document.createElement("div");
      root.className = "volume-widget";
      root.dataset.feature = "volume";
      button = document.createElement("button");
      button.type = "button";
      button.className = "ctrl";
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      button.innerHTML = ICON;
      panel = document.createElement("div");
      panel.className = "volume-panel hidden";
      panel.setAttribute("role", "dialog");
      slider = document.createElement("input");
      slider.type = "range";
      slider.className = "volume-slider";
      slider.step = "1";
      valueEl = document.createElement("span");
      valueEl.className = "volume-value";
      panel.append(slider, valueEl);
      root.append(button, panel);
      host.appendChild(root);

      const onToggle = (event) => {
        event.preventDefault();
        if (button.disabled) return;
        setPanelOpen(panel.classList.contains("hidden"));
      };
      const onInput = () => setLevel(Number(slider.value), true);
      const onChange = () => {
        setLevel(Number(slider.value), false);
        sendLevel(false);
      };
      const onDoc = (event) => {
        if (!root.contains(event.target)) setPanelOpen(false);
      };

      button.addEventListener("click", onToggle);
      slider.addEventListener("input", onInput);
      slider.addEventListener("change", onChange);
      document.addEventListener("pointerdown", onDoc);
      syncUi();

      return () => {
        if (sendTimer) clearTimeout(sendTimer);
        sendTimer = null;
        button.removeEventListener("click", onToggle);
        slider.removeEventListener("input", onInput);
        slider.removeEventListener("change", onChange);
        document.removeEventListener("pointerdown", onDoc);
        root.remove();
        root = button = slider = valueEl = panel = null;
        host.hidden = true;
        ctx = null;
      };
    },
    update(caps, nextCtx) {
      ctx = nextCtx;
      applyRangeFromCaps(caps);
      syncUi();
    },
    onStatus(payload) {
      const parsed = parseRobotStatus(payload);
      if (!parsed.audio) return;
      min = parsed.audio.min;
      max = parsed.audio.max;
      level = parsed.audio.volume;
      syncUi();
    },
    setEnabled(enabled) {
      if (button) button.disabled = !enabled;
      if (!enabled) setPanelOpen(false);
    },
    refreshLabels() {
      syncUi();
    },
  };
}

import { isPowerAvailable } from "../protocol/capabilities.js";
import { parseRobotStatus } from "../protocol/status.js";

const ICON = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <rect x="7" y="7" width="12" height="12" rx="2.2" stroke="currentColor" stroke-width="1.8"/>
  <path d="M9.2 13.2h3.1v4L16.8 11h-3.1V7L9.2 13.2Z" fill="currentColor"/>
  <path d="M7 11H5.6A1.6 1.6 0 0 0 4 12.6v2.8A1.6 1.6 0 0 0 5.6 17H7" stroke="currentColor" stroke-width="1.8"/>
</svg>`;

/**
 * @param {object} els
 * @param {(key: string, vars?: object) => string} t
 */
export function createPowerFeature(els, t) {
  let chip = null;
  let last = { level: null, charging: false };

  function applyChip() {
    if (!chip) return;
    const { level, charging } = last;
    const known = typeof level === "number";
    const label = known
      ? charging
        ? t("power.charging", { pct: level })
        : t("power.level", { pct: level })
      : t("power.unknown");
    chip.setAttribute("aria-label", label);
    chip.title = label;
    const text = chip.querySelector("[data-power-text]");
    if (text) text.textContent = known ? `${level}%` : "—";
    chip.classList.toggle("is-charging", Boolean(charging && known));
    chip.classList.toggle("is-low", known && level <= 20);
    chip.classList.toggle("is-mid", known && level > 20 && level <= 50);
  }

  return {
    id: "power",
    optIn: true,
    isAvailable: isPowerAvailable,
    /**
     * @param {import("./registry.js").FeatureContext} ctx
     */
    mount(nextCtx) {
      const host = nextCtx.host("power") || els.powerHost;
      if (!host) return () => {};
      host.hidden = false;
      chip = document.createElement("div");
      chip.className = "power-chip";
      chip.dataset.feature = "power";
      chip.setAttribute("role", "status");
      chip.innerHTML = `${ICON}<span data-power-text>—</span>`;
      host.appendChild(chip);
      const seeded = parseRobotStatus(nextCtx.caps).power;
      if (seeded) last = seeded;
      applyChip();
      return () => {
        chip.remove();
        chip = null;
        host.hidden = true;
      };
    },
    onStatus(payload) {
      const parsed = parseRobotStatus(payload);
      if (!parsed.power) return;
      last = parsed.power;
      applyChip();
    },
    refreshLabels() {
      applyChip();
    },
  };
}

import { isFlashlightAvailable } from "../protocol/capabilities.js";

const ICON = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M8 3h8l1.5 6H6.5L8 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M9 9v8.5A2.5 2.5 0 0 0 11.5 20h1A2.5 2.5 0 0 0 15 17.5V9" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M12 12v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

export const flashlightFeature = {
  id: "flashlight",
  optIn: true,
  isAvailable: isFlashlightAvailable,
  /**
   * @param {import("./registry.js").FeatureContext} ctx
   */
  mount(ctx) {
    const host = ctx.host("call");
    if (!host) return () => {};

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ctrl";
    btn.dataset.feature = "flashlight";
    btn.innerHTML = ICON;
    btn.disabled = !ctx.isConnected();
    btn.setAttribute("aria-label", ctx.t("media.flashlight"));

    const modes = ctx.caps?.flashlight?.modes || ["toggle"];
    const action = modes.includes("toggle") ? "flashlight.toggle" : "flashlight.on";

    btn.addEventListener("click", () => {
      if (btn.disabled || !ctx.isConnected()) return;
      ctx.sendControl(action, undefined, { volatile: false });
    });

    host.appendChild(btn);
    return () => btn.remove();
  },
};

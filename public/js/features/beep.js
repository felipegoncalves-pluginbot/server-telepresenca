import { isBeepAvailable } from "../protocol/capabilities.js";

export const beepFeature = {
  id: "beep",
  optIn: false,
  isAvailable: isBeepAvailable,
  /**
   * @param {import("./registry.js").FeatureContext} ctx
   */
  mount(ctx) {
    const button = document.getElementById("btnSendCommand");
    if (!button) return () => {};

    button.hidden = false;
    const onClick = () => {
      if (button.disabled || !ctx.isConnected()) return;
      ctx.sendControl("beep");
    };
    button.addEventListener("click", onClick);

    return () => {
      button.removeEventListener("click", onClick);
      button.hidden = true;
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
};

/**
 * Shared HUD popover chrome for toolbar settings dialogs.
 * Volume, video quality and similar panels should use these helpers
 * so the operator UI does not grow a new window style per feature.
 */

/**
 * @param {{ title?: string }} [opts]
 */
export function createPopover(opts = {}) {
  const panel = document.createElement("div");
  panel.className = "hud-popover hidden";
  panel.setAttribute("role", "dialog");

  const head = document.createElement("div");
  head.className = "hud-popover-head";

  const title = document.createElement("h2");
  title.className = "hud-popover-title";
  if (opts.title) title.textContent = opts.title;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "hud-popover-close";
  closeButton.textContent = "×";

  const body = document.createElement("div");
  body.className = "hud-popover-body";

  head.append(title, closeButton);
  panel.append(head, body);
  return { panel, title, closeButton, body };
}

/**
 * Close the popover on outside pointer or Escape.
 *
 * @param {Element} root element that contains trigger + panel
 * @param {{ isOpen: () => boolean, setOpen: (open: boolean) => void }} api
 */
export function bindPopoverDismiss(root, api) {
  const onPointerDown = (event) => {
    if (!api.isOpen()) return;
    if (root.contains(event.target)) return;
    api.setOpen(false);
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape" && api.isOpen()) api.setOpen(false);
  };
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown);
  return () => {
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeyDown);
  };
}

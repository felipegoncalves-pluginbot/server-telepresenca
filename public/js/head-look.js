import { LOOK_CLICK_PX, grabStep } from "./protocol/look.js";

const PREVIEW_GAIN = 0.18;
const PREVIEW_MAX_PX = 36;
const DOUBLE_MS = 340;

/**
 * Street View-style grab on the live video. Reports incremental look deltas.
 * @param {HTMLElement} layer
 * @param {object} options
 * @param {(delta: { yaw: number, pitch: number }) => void} [options.onDelta]
 * @param {() => void} [options.onReset]
 * @param {(preview: { x: number, y: number } | null) => void} [options.onPreview]
 * @param {() => DOMRect} [options.rect]
 */
export function createHeadLookSurface(layer, options) {
  const onDelta = options.onDelta || (() => {});
  const onReset = options.onReset || (() => {});
  const onPreview = options.onPreview || (() => {});
  const rectOf = options.rect || (() => layer.getBoundingClientRect());

  let enabled = true;
  let axes = { yaw: true, pitch: true };
  let pointerId = null;
  let lastX = 0;
  let lastY = 0;
  let originX = 0;
  let originY = 0;
  let moved = 0;
  let lastTapAt = 0;

  function setEnabled(value) {
    enabled = Boolean(value);
    layer.classList.toggle("is-disabled", !enabled);
    layer.setAttribute("aria-disabled", enabled ? "false" : "true");
    if (!enabled) endDrag(false);
  }

  function setAxes(next) {
    axes = {
      yaw: next?.yaw !== false,
      pitch: next?.pitch !== false,
    };
  }

  function previewFrom(dx, dy) {
    const x = Math.max(-PREVIEW_MAX_PX, Math.min(PREVIEW_MAX_PX, dx * PREVIEW_GAIN));
    const y = Math.max(-PREVIEW_MAX_PX, Math.min(PREVIEW_MAX_PX, dy * PREVIEW_GAIN));
    onPreview({ x, y });
  }

  function endDrag(countTap) {
    if (pointerId == null) return;
    const wasClick = moved < LOOK_CLICK_PX;
    pointerId = null;
    moved = 0;
    layer.classList.remove("is-dragging");
    onPreview(null);
    if (!countTap || !wasClick) return;
    const now = Date.now();
    if (now - lastTapAt <= DOUBLE_MS) {
      lastTapAt = 0;
      onReset();
      return;
    }
    lastTapAt = now;
  }

  function onPointerDown(event) {
    if (!enabled) return;
    if (event.button != null && event.button !== 0) return;
    if (pointerId != null) return;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    originX = event.clientX;
    originY = event.clientY;
    moved = 0;
    layer.classList.add("is-dragging");
    if (layer.setPointerCapture) layer.setPointerCapture(pointerId);
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    moved += Math.hypot(dx, dy);
    const box = rectOf();
    const step = grabStep(dx, dy, box);
    if (!axes.yaw) step.yaw = 0;
    if (!axes.pitch) step.pitch = 0;
    if (step.yaw !== 0 || step.pitch !== 0) onDelta(step);
    previewFrom(event.clientX - originX, event.clientY - originY);
  }

  function onPointerUp(event) {
    if (event.pointerId !== pointerId) return;
    endDrag(true);
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  layer.addEventListener("pointerdown", onPointerDown);
  layer.addEventListener("pointermove", onPointerMove);
  layer.addEventListener("pointerup", onPointerUp);
  layer.addEventListener("pointercancel", onPointerUp);
  layer.addEventListener("contextmenu", onContextMenu);
  setEnabled(true);

  return {
    setEnabled,
    setAxes,
    destroy() {
      endDrag(false);
      layer.removeEventListener("pointerdown", onPointerDown);
      layer.removeEventListener("pointermove", onPointerMove);
      layer.removeEventListener("pointerup", onPointerUp);
      layer.removeEventListener("pointercancel", onPointerUp);
      layer.removeEventListener("contextmenu", onContextMenu);
    },
  };
}

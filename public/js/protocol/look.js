/**
 * Head look math. Normalized pose is yaw/pitch in [-1, 1].
 * Street View grab: drag right looks left; drag down looks up.
 */

export const LOOK_SENSITIVITY = 1.4;
export const LOOK_KEY_RATE = 0.7;
export const LOOK_CLICK_PX = 6;

/**
 * @param {unknown} value
 */
export function clampAxis(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value > 1) return 1;
  if (value < -1) return -1;
  return value;
}

/**
 * @param {{ yaw?: unknown, pitch?: unknown } | null | undefined} pose
 */
export function clampLook(pose) {
  return {
    yaw: clampAxis(pose?.yaw),
    pitch: clampAxis(pose?.pitch),
  };
}

/**
 * Incremental grab step from pointer movement, in normalized units.
 * @param {number} movementX
 * @param {number} movementY
 * @param {{ width?: number, height?: number, sensitivity?: number }} [view]
 */
export function grabStep(movementX, movementY, view = {}) {
  const w = view.width > 0 ? view.width : 1;
  const h = view.height > 0 ? view.height : 1;
  const gain =
    typeof view.sensitivity === "number" && view.sensitivity > 0
      ? view.sensitivity
      : LOOK_SENSITIVITY;
  return {
    yaw: clampAxis((-movementX / w) * gain),
    pitch: clampAxis((movementY / h) * gain),
  };
}

/**
 * @param {{ yaw: number, pitch: number }} pose
 * @param {{ yaw?: number, pitch?: number }} delta
 * @param {{ yaw?: boolean, pitch?: boolean }} [axes]
 */
export function addLook(pose, delta, axes = {}) {
  const yawOn = axes.yaw !== false;
  const pitchOn = axes.pitch !== false;
  return clampLook({
    yaw: yawOn ? pose.yaw + (delta.yaw || 0) : pose.yaw,
    pitch: pitchOn ? pose.pitch + (delta.pitch || 0) : pose.pitch,
  });
}

/**
 * I/K/J/L look in the key direction (not grab-the-world).
 * @param {string} key
 */
export function lookKeyDelta(key) {
  if (key === "i") return { yaw: 0, pitch: 1 };
  if (key === "k") return { yaw: 0, pitch: -1 };
  if (key === "j") return { yaw: -1, pitch: 0 };
  if (key === "l") return { yaw: 1, pitch: 0 };
  return null;
}

/**
 * @param {unknown} value
 */
export function parseLookValue(value) {
  if (!value || typeof value !== "object") return clampLook({ yaw: 0, pitch: 0 });
  return clampLook(value);
}

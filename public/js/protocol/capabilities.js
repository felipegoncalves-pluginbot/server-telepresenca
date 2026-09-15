/**
 * Robot capability helpers. Operator UI branches on these, never on robotModel.
 */

/**
 * @param {object | null | undefined} caps
 */
export function isLocomotionAvailable(caps) {
  if (caps == null) return true;
  if (caps.locomotion === false) return false;
  if (caps.locomotion && caps.locomotion.available === false) return false;
  return true;
}

/**
 * @param {object | null | undefined} caps
 */
export function isBeepAvailable(caps) {
  if (caps == null) return true;
  if (caps.audio && caps.audio.beep === false) return false;
  return true;
}

/**
 * @param {object | null | undefined} caps
 */
export function isFlashlightAvailable(caps) {
  return caps?.flashlight?.available === true;
}

/**
 * @param {object | null | undefined} caps
 */
export function isContinuousBackward(caps) {
  return caps?.locomotion?.backwardMode === "continuous";
}

/**
 * @param {object | null | undefined} caps
 */
export function backwardPulseDistanceM(caps) {
  const value = caps?.locomotion?.backwardPulseDistanceM;
  return typeof value === "number" && value > 0 ? value : 0.2;
}

/**
 * @param {unknown} caps
 * @returns {object | null}
 */
export function normalizeCapabilities(caps) {
  if (!caps || typeof caps !== "object") return null;
  return caps;
}

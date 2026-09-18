/**
 * Robot → operator telemetry (battery + volume).
 *
 * @param {unknown} payload
 */
export function parseRobotStatus(payload) {
  if (!payload || typeof payload !== "object") {
    return { power: null, audio: null };
  }
  return {
    power: parsePower(payload.power),
    audio: parseAudio(payload.audio),
  };
}

/**
 * @param {unknown} raw
 */
function parsePower(raw) {
  if (!raw || typeof raw !== "object") return null;
  const level = Number(raw.level);
  if (!Number.isFinite(level)) return null;
  return {
    level: clampInt(level, 0, 100),
    charging: Boolean(raw.charging),
  };
}

/**
 * @param {unknown} raw
 */
function parseAudio(raw) {
  if (!raw || typeof raw !== "object") return null;
  const volume = Number(raw.volume);
  if (!Number.isFinite(volume)) return null;
  const min = Number.isFinite(Number(raw.min)) ? Math.round(Number(raw.min)) : 0;
  let max = Number.isFinite(Number(raw.max)) ? Math.round(Number(raw.max)) : 10;
  if (max <= min) max = min + 1;
  return {
    volume: clampInt(volume, min, max),
    min,
    max,
  };
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 */
export function parseVolumeLevel(value, min, max, fallback) {
  let level = fallback;
  if (typeof value === "number" && Number.isFinite(value)) {
    level = value;
  } else if (value && typeof value === "object") {
    if (typeof value.level === "number") level = value.level;
    else if (typeof value.volume === "number") level = value.volume;
  }
  return clampInt(level, min, max);
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

import { isExpired } from "./expiry.js";

export const EVENT_SESSION_EXPIRED = "session-expired";

/**
 * @param {number | null | undefined} expiresAt
 * @param {number} [now]
 * @returns {number | null}
 */
export function expiryDelayMs(expiresAt, now = Date.now()) {
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) return null;
  return expiresAt - now;
}

/**
 * @param {number | null | undefined} expiresAt
 * @param {number} [now]
 */
export function shouldExpireRoom(expiresAt, now = Date.now()) {
  return isExpired(expiresAt, now);
}

/**
 * @param {{ operator?: string, robot?: string } | null | undefined} room
 * @returns {Array<{ role: "operator" | "robot", socketId: string }>}
 */
export function occupantSockets(room) {
  if (!room) return [];
  /** @type {Array<{ role: "operator" | "robot", socketId: string }>} */
  const out = [];
  if (room.operator) out.push({ role: "operator", socketId: room.operator });
  if (room.robot) out.push({ role: "robot", socketId: room.robot });
  return out;
}

/**
 * @param {{ expiryTimer?: ReturnType<typeof setTimeout> | null } | null | undefined} room
 */
export function clearExpiryTimer(room) {
  if (!room || !room.expiryTimer) return room;
  clearTimeout(room.expiryTimer);
  room.expiryTimer = null;
  return room;
}

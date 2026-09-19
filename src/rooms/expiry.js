/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseExpiresAt(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {number | null | undefined} expiresAt
 * @param {number} [now]
 */
export function isExpired(expiresAt, now = Date.now()) {
  return typeof expiresAt === "number" && now > expiresAt;
}

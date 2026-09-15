const SECRET_KEY = /username|credential|password|secret|turn_/i;

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function redact(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, nested] of Object.entries(value)) {
    out[key] = SECRET_KEY.test(key) ? "[redacted]" : redact(nested);
  }
  return out;
}

export function createLogger() {
  return {
    info: (...args) => {
      console.log(...args);
    },
    error: (...args) => {
      console.error(...args);
    },
    debug: (message, payload) => {
      if (payload === undefined) {
        console.log(message);
        return;
      }
      console.log(message, redact(payload));
    },
  };
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string | undefined} raw
 * @returns {string[]}
 */
export function splitCsv(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function loadEnvFile(env = process.env) {
  const envPath = path.join(ROOT_DIR, ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
  return env;
}

/**
 * @typedef {object} AppConfig
 * @property {number} port
 * @property {string | string[]} corsOrigin
 * @property {string[]} stunUrls
 * @property {string[]} turnUrls
 * @property {string} turnUsername
 * @property {string} turnCredential
 * @property {string} robotsApiUrl
 */

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {AppConfig}
 */
export function loadConfig(env = process.env) {
  const corsRaw = env.CORS_ORIGIN;
  /** @type {string | string[]} */
  let corsOrigin = "*";
  if (typeof corsRaw === "string" && corsRaw.trim() && corsRaw.trim() !== "*") {
    const origins = splitCsv(corsRaw);
    corsOrigin = origins.length <= 1 ? origins[0] || "*" : origins;
  }

  return {
    port: Number.parseInt(env.PORT || "4040", 10) || 4040,
    corsOrigin,
    stunUrls: splitCsv(env.STUN_URLS),
    turnUrls: splitCsv(env.TURN_URLS),
    turnUsername: env.TURN_USERNAME || "",
    turnCredential: env.TURN_CREDENTIAL || "",
    robotsApiUrl: (env.ROBOTS_API_URL || "").replace(/\/$/, ""),
  };
}

export { ROOT_DIR };

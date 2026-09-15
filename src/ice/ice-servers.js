/**
 * @typedef {import("../config.js").AppConfig} AppConfig
 * @typedef {{ urls: string, username?: string, credential?: string }} IceServer
 */

/**
 * Build RTCConfiguration.iceServers from env-backed config.
 * Pure: never reads process.env.
 *
 * @param {AppConfig} config
 * @returns {IceServer[]}
 */
export function buildIceServers(config) {
  /** @type {IceServer[]} */
  const iceServers = [];
  for (const urls of config.stunUrls) {
    iceServers.push({ urls });
  }
  if (config.turnUsername && config.turnCredential) {
    for (const urls of config.turnUrls) {
      iceServers.push({
        urls,
        username: config.turnUsername,
        credential: config.turnCredential,
      });
    }
  }
  return iceServers;
}

import http from "node:http";
import https from "node:https";

/**
 * @param {string} inviteId
 * @param {string} [suffix]
 */
export function robotsInvitePath(inviteId, suffix = "") {
  return `/apps/invite_manager/invites/${encodeURIComponent(inviteId)}${suffix}`;
}

/**
 * @param {string} robotsApiUrl
 * @param {string} inviteId
 * @param {string} [suffix]
 */
export function robotsInviteUrl(robotsApiUrl, inviteId, suffix = "") {
  const root = String(robotsApiUrl || "").replace(/\/$/, "");
  return `${root}${robotsInvitePath(inviteId, suffix)}`;
}

/**
 * @param {object} options
 * @param {string} options.robotsApiUrl
 * @param {string} options.inviteId
 * @param {string} [options.suffix]
 * @param {string} [options.method]
 * @param {string} [options.body]
 * @returns {Promise<{ status: number, body: string }>}
 */
export function proxyInvite({
  robotsApiUrl,
  inviteId,
  suffix = "",
  method = "GET",
  body = "",
}) {
  const target = new URL(robotsInviteUrl(robotsApiUrl, inviteId, suffix));
  const lib = target.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = lib.request(
      target,
      {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            status: response.statusCode || 502,
            body: Buffer.concat(chunks).toString("utf8") || "{}",
          });
        });
      },
    );
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

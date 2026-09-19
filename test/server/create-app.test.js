import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { createApp } from "../../src/http/create-app.js";
import { ROOT } from "../helpers/load-schema.js";
import { test } from "../helpers/test.js";

/**
 * @param {string} url
 * @returns {Promise<{ statusCode: number, headers: Record<string, string | string[] | undefined>, body: string }>}
 */
function request(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      })
      .on("error", reject);
  });
}

test("/health and /ice-servers are served from the signaling app", async () => {
  const iceServers = [{ urls: "stun:stun.example:80" }];
  const app = createApp({
    publicDir: path.join(ROOT, "public"),
    iceServers,
    robotsApiUrl: "",
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const health = await request(`${base}/health`);
    assert.equal(health.statusCode, 200);
    const healthBody = JSON.parse(health.body);
    assert.equal(healthBody.ok, true);
    assert.equal(healthBody.service, "telepresenca-signaling");

    const ice = await request(`${base}/ice-servers`);
    assert.equal(ice.statusCode, 200);
    assert.equal(ice.headers["cache-control"], "no-store");
    const iceBody = JSON.parse(ice.body);
    assert.deepEqual(iceBody.iceServers, iceServers);

    const cfg = await request(`${base}/config`);
    assert.equal(cfg.statusCode, 200);
    assert.equal(JSON.parse(cfg.body).robotsApiUrl, "");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

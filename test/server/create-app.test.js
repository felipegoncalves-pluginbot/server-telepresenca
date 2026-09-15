import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import { createApp } from "../../src/http/create-app.js";
import { ROOT } from "../helpers/load-schema.js";

test("/health and /ice-servers are served from the signaling app", async () => {
  const iceServers = [{ urls: "stun:stun.example:80" }];
  const app = createApp({
    publicDir: path.join(ROOT, "public"),
    iceServers,
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const health = await fetch(`${base}/health`);
    assert.equal(health.ok, true);
    const healthBody = await health.json();
    assert.equal(healthBody.ok, true);
    assert.equal(healthBody.service, "telepresenca-signaling");

    const ice = await fetch(`${base}/ice-servers`);
    assert.equal(ice.ok, true);
    assert.equal(ice.headers.get("cache-control"), "no-store");
    const iceBody = await ice.json();
    assert.deepEqual(iceBody.iceServers, iceServers);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

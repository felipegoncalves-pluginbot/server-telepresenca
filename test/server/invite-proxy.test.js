import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { createApp } from "../../src/http/create-app.js";
import {
  proxyInvite,
  robotsInvitePath,
  robotsInviteUrl,
} from "../../src/http/invite-proxy.js";
import { ROOT } from "../helpers/load-schema.js";
import { test } from "../helpers/test.js";

test("robots invite paths stay on the invite_manager API", () => {
  assert.equal(
    robotsInvitePath("uid-1", "/join"),
    "/apps/invite_manager/invites/uid-1/join",
  );
  assert.equal(
    robotsInviteUrl("http://localhost:3333/", "uid-1"),
    "http://localhost:3333/apps/invite_manager/invites/uid-1",
  );
});

test("proxyInvite forwards status and JSON body", async () => {
  const api = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ id: "uid-1", locale: "en", path: req.url }));
  });
  await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
  const address = api.address();
  assert.ok(address && typeof address === "object");
  try {
    const result = await proxyInvite({
      robotsApiUrl: `http://127.0.0.1:${address.port}`,
      inviteId: "uid-1",
    });
    assert.equal(result.status, 200);
    assert.equal(JSON.parse(result.body).id, "uid-1");
  } finally {
    await new Promise((resolve) => api.close(resolve));
  }
});

test("createApp returns 503 when ROBOTS_API_URL is missing", async () => {
  const app = createApp({
    publicDir: path.join(ROOT, "public"),
    iceServers: [],
    robotsApiUrl: "",
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    const body = await new Promise((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${address.port}/invite-session/uid-1`, (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            resolve({
              status: res.statusCode,
              json: JSON.parse(Buffer.concat(chunks).toString("utf8")),
            });
          });
        })
        .on("error", reject);
    });
    assert.equal(body.status, 503);
    assert.equal(body.json.code, "invite_missing_api");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

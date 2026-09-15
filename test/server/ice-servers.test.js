import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import { buildIceServers } from "../../src/ice/ice-servers.js";
import { compileSchema } from "../helpers/load-schema.js";

const validate = compileSchema("schemas/ice-servers.schema.json");

test("STUN only when TURN credentials are missing", () => {
  const iceServers = buildIceServers({
    stunUrls: ["stun:stun.example:80"],
    turnUrls: ["turn:turn.example:80"],
    turnUsername: "",
    turnCredential: "",
  });
  assert.deepEqual(iceServers, [{ urls: "stun:stun.example:80" }]);
  assert.equal(validate({ iceServers }), true);
});

test("TURN entries include username and credential", () => {
  const iceServers = buildIceServers({
    stunUrls: ["stun:stun.example:80"],
    turnUrls: ["turn:turn.example:80", "turns:turn.example:443?transport=tcp"],
    turnUsername: "alice",
    turnCredential: "s3cret",
  });
  assert.equal(iceServers.length, 3);
  assert.equal(iceServers[1].username, "alice");
  assert.equal(iceServers[1].credential, "s3cret");
  assert.equal(validate({ iceServers }), true);
});

test("empty config yields an empty list (LAN host candidates)", () => {
  const iceServers = buildIceServers({
    stunUrls: [],
    turnUrls: [],
    turnUsername: "",
    turnCredential: "",
  });
  assert.deepEqual(iceServers, []);
  assert.equal(validate({ iceServers }), true);
});

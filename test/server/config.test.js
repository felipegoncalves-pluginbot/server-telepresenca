import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import { loadConfig, splitCsv } from "../../src/config.js";

test("splitCsv trims and drops empties", () => {
  assert.deepEqual(splitCsv(" a, b , ,c "), ["a", "b", "c"]);
  assert.deepEqual(splitCsv(""), []);
});

test("loadConfig reads PORT and ICE lists from an env object", () => {
  const config = loadConfig({
    PORT: "5050",
    STUN_URLS: "stun:example:80",
    TURN_URLS: "turn:example:80,turns:example:443",
    TURN_USERNAME: "user",
    TURN_CREDENTIAL: "secret",
    CORS_ORIGIN: "*",
  });
  assert.equal(config.port, 5050);
  assert.deepEqual(config.stunUrls, ["stun:example:80"]);
  assert.equal(config.turnUrls.length, 2);
  assert.equal(config.turnUsername, "user");
  assert.equal(config.corsOrigin, "*");
});

test("missing TURN credentials keep username empty", () => {
  const config = loadConfig({ STUN_URLS: "stun:x" });
  assert.equal(config.turnUsername, "");
  assert.equal(config.turnCredential, "");
  assert.equal(config.port, 4040);
});

import assert from "node:assert/strict";
import { redact } from "../../src/log.js";
import test from "../helpers/harness.js";

test("redact hides credential-like keys", () => {
  const hidden = redact({
    urls: "turn:example",
    username: "alice",
    credential: "s3cret",
  });
  assert.equal(hidden.urls, "turn:example");
  assert.equal(hidden.username, "[redacted]");
  assert.equal(hidden.credential, "[redacted]");
});

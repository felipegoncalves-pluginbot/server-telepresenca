import assert from "node:assert/strict";
import { createIceQueue } from "../../public/js/webrtc/ice-queue.js";
import test from "../helpers/harness.js";

test("ICE queue holds candidates until remote description is set", async () => {
  const queue = createIceQueue();
  const applied = [];
  assert.equal(queue.enqueueIfNeeded({ candidate: "a" }), true);
  assert.equal(queue.enqueueIfNeeded({ candidate: "b" }), true);
  assert.equal(queue.size(), 2);
  assert.equal(queue.isRemoteReady(), false);

  await queue.flush((candidate) => {
    applied.push(candidate.candidate);
  });

  assert.deepEqual(applied, ["a", "b"]);
  assert.equal(queue.size(), 0);
  assert.equal(queue.isRemoteReady(), true);
  assert.equal(queue.enqueueIfNeeded({ candidate: "c" }), false);
});

test("ICE queue reset forgets stale candidates", async () => {
  const queue = createIceQueue();
  queue.enqueueIfNeeded({ candidate: "old" });
  queue.reset();
  assert.equal(queue.size(), 0);
  assert.equal(queue.isRemoteReady(), false);
  await queue.flush(() => {
    throw new Error("should not flush stale ICE");
  });
  assert.equal(queue.isRemoteReady(), true);
});

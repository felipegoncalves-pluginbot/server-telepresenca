import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import {
  createHostFallback,
  offerSignalData,
} from "../../public/js/webrtc/host-fallback.js";

test("offer marks Metered escalation without dropping the SDP", () => {
  assert.deepEqual(offerSignalData({ type: "offer", sdp: "v=0" }, false), {
    type: "offer",
    sdp: "v=0",
  });
  assert.equal(offerSignalData({ type: "offer", sdp: "v=0" }, true).escalate, true);
});

test("escalate applies fallback servers once", async () => {
  const restarts = [];
  let metered = false;
  const pc = {
    /** @type {RTCIceServer[] | null} */
    servers: null,
    setConfiguration(config) {
      this.servers = config.iceServers;
    },
  };
  const fallback = createHostFallback({
    getPc: () => pc,
    getFallbackServers: () => [{ urls: "turn:example:443" }],
    onUseMetered() {
      metered = true;
    },
    restart: async (opts) => {
      restarts.push(opts);
    },
    timeoutMs: 60000,
  });
  await fallback.escalate("failed");
  await fallback.escalate("failed");
  assert.equal(restarts.length, 1);
  assert.equal(restarts[0].escalate, true);
  assert.equal(restarts[0].iceRestart, true);
  assert.equal(metered, true);
  assert.equal(pc.servers[0].urls, "turn:example:443");
});

test("a direct connect cancels the Metered timeout", async () => {
  let escalated = 0;
  const fallback = createHostFallback({
    getPc: () => ({ setConfiguration() {} }),
    getFallbackServers: () => [{ urls: "stun:example" }],
    restart: async () => {
      escalated += 1;
    },
    timeoutMs: 40,
  });
  fallback.arm();
  fallback.markConnected();
  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.equal(escalated, 0);
});

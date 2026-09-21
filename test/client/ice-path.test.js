import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import {
  formatGatheredMessage,
  formatIcePathMessage,
  liveStatusKey,
  liveStatusMode,
  mediaPathKind,
  readSelectedPair,
  summarizeGathered,
} from "../../public/js/webrtc/ice-path.js";

test("summarizeGathered counts only local candidates", () => {
  const counts = summarizeGathered([
    { type: "local-candidate", candidateType: "host" },
    { type: "local-candidate", candidateType: "srflx" },
    { type: "local-candidate", candidateType: "relay" },
    { type: "remote-candidate", candidateType: "relay" },
  ]);
  assert.deepEqual(counts, { host: 1, srflx: 1, prflx: 0, relay: 1 });
});

test("formatGatheredMessage explains relay is only a reserve", () => {
  const message = formatGatheredMessage({ host: 1, srflx: 1, prflx: 0, relay: 2 });
  assert.match(message, /1 host, 1 srflx, 2 relay/);
  assert.match(message, /reserva/);
});

test("readSelectedPair prefers the transport pair and flags relay", () => {
  const stats = new Map([
    ["T1", { id: "T1", type: "transport", selectedCandidatePairId: "P1" }],
    [
      "P1",
      {
        id: "P1",
        type: "candidate-pair",
        localCandidateId: "L1",
        remoteCandidateId: "R1",
      },
    ],
    ["L1", { id: "L1", candidateType: "relay", protocol: "udp", relayProtocol: "tcp" }],
    ["R1", { id: "R1", candidateType: "host", protocol: "udp" }],
  ]);
  const pair = readSelectedPair(stats);
  assert.equal(pair.usingRelay, true);
  assert.equal(pair.localType, "relay");
  assert.equal(pair.remoteType, "host");
  assert.equal(pair.protocol, "tcp");
  assert.equal(formatIcePathMessage(pair).level, "warn");
});

test("direct host pair is not a TURN warning", () => {
  const stats = new Map([
    [
      "P1",
      {
        id: "P1",
        type: "candidate-pair",
        nominated: true,
        state: "succeeded",
        localCandidateId: "L1",
        remoteCandidateId: "R1",
      },
    ],
    ["L1", { id: "L1", candidateType: "host", protocol: "udp" }],
    ["R1", { id: "R1", candidateType: "host", protocol: "udp" }],
  ]);
  const pair = readSelectedPair(stats);
  assert.equal(pair.usingRelay, false);
  const entry = formatIcePathMessage(pair);
  assert.equal(entry.level, "info");
  assert.match(entry.message, /caminho direto/);
  assert.equal(mediaPathKind(pair), "udp");
  assert.equal(liveStatusKey("udp"), "status.liveUdp");
  assert.equal(liveStatusMode("udp"), "live");
});

test("relay pair is labeled TURN", () => {
  assert.equal(mediaPathKind({ usingRelay: true }), "turn");
  assert.equal(liveStatusKey("turn"), "status.liveTurn");
  assert.equal(liveStatusMode("turn"), "live live-turn");
});

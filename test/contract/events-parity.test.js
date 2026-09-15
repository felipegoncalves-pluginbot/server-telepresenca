import assert from "node:assert/strict";
import { test } from "node:test";
import * as clientEvents from "../../public/js/protocol/events.js";
import {
  events as serverEvents,
  isKnownRole,
  normalizeRole,
  peerRole,
  ROLE_OPERATOR,
  ROLE_ROBOT,
  ROLE_VISITOR,
} from "../../src/protocol/events.js";
import { readJson } from "../helpers/load-schema.js";

const schema = readJson("schemas/events.json");

test("server events module matches schemas/events.json", () => {
  assert.deepEqual(serverEvents.clientToServer, schema.clientToServer);
  assert.deepEqual(serverEvents.serverToClient, schema.serverToClient);
  assert.deepEqual(serverEvents.roles, schema.roles);
});

test("client event literals exist in the schema", () => {
  for (const name of clientEvents.CLIENT_TO_SERVER) {
    assert.ok(schema.clientToServer.includes(name), `missing client event ${name}`);
  }
  for (const name of clientEvents.SERVER_TO_CLIENT) {
    assert.ok(schema.serverToClient.includes(name), `missing server event ${name}`);
  }
});

test("visitor aliases to operator; only operator and robot occupy a slot", () => {
  assert.equal(normalizeRole(ROLE_VISITOR), ROLE_OPERATOR);
  assert.equal(normalizeRole("operator"), ROLE_OPERATOR);
  assert.equal(normalizeRole(null), "");
  assert.equal(isKnownRole(ROLE_OPERATOR), true);
  assert.equal(isKnownRole(ROLE_ROBOT), true);
  assert.equal(isKnownRole(ROLE_VISITOR), false);
  assert.equal(peerRole(ROLE_OPERATOR), ROLE_ROBOT);
  assert.equal(peerRole(ROLE_ROBOT), ROLE_OPERATOR);
});

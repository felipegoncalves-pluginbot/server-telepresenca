import assert from "node:assert/strict";
import * as clientEvents from "../../public/js/protocol/events.js";
import { events as serverEvents } from "../../src/protocol/events.js";
import test from "../helpers/harness.js";
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

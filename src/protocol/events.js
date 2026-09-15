import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../schemas/events.json",
);

/** @type {{ roles: string[], roleAlias: Record<string, string>, clientToServer: string[], serverToClient: string[], signalTypes: string[] }} */
export const events = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

export const ROLE_OPERATOR = "operator";
export const ROLE_ROBOT = "robot";
export const ROLE_VISITOR = "visitor";

/**
 * @param {unknown} role
 * @returns {string}
 */
export function normalizeRole(role) {
  if (role === ROLE_VISITOR) return ROLE_OPERATOR;
  if (typeof role === "string" && events.roleAlias[role]) {
    return events.roleAlias[role];
  }
  return typeof role === "string" ? role : "";
}

/**
 * @param {string} role
 */
export function isKnownRole(role) {
  return role === ROLE_OPERATOR || role === ROLE_ROBOT;
}

export function peerRole(role) {
  return role === ROLE_OPERATOR ? ROLE_ROBOT : ROLE_OPERATOR;
}

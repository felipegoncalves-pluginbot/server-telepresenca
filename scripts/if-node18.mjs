#!/usr/bin/env node
/**
 * Run a quality tool only when Node is new enough (ESLint 9 / knip / depcruise).
 * Tests use node:test (Node >= 20). Prettier still runs on older Node.
 */
import { spawnSync } from "node:child_process";

const [major, minor] = process.versions.node.split(".").map(Number);
const supported = major > 18 || (major === 18 && minor >= 18);
const [bin, ...args] = process.argv.slice(2);

if (!bin) {
  console.error("usage: node scripts/if-node18.mjs <command> [args...]");
  process.exit(2);
}

if (!supported) {
  console.log(`${bin} skipped (Node ${process.version}; this tool needs >= 18.18).`);
  process.exit(0);
}

const result = spawnSync(bin, args, { stdio: "inherit", shell: false });
process.exit(result.status ?? 1);

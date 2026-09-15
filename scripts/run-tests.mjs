#!/usr/bin/env node
/**
 * Discover *.test.js under test/ and run them. Works on Node 16 (no native test runner).
 * New test files are picked up automatically — do not add a manifesto.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const [major, minor] = process.versions.node.split(".").map(Number);
const eslintOk = major > 18 || (major === 18 && minor >= 18);

/**
 * @param {string} dir
 * @param {string[]} [acc]
 * @returns {string[]}
 */
function listTestFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listTestFiles(full, acc);
    else if (entry.name.endsWith(".test.js")) acc.push(full);
  }
  return acc;
}

const files = listTestFiles(path.join(ROOT, "test"))
  .filter((file) => {
    if (eslintOk) return true;
    const rel = path.relative(path.join(ROOT, "test"), file);
    return !rel.startsWith(`lint${path.sep}`) && !rel.startsWith("lint/");
  })
  .sort();

if (!eslintOk) {
  console.log(
    `Skipping test/lint/* (ESLint 9 needs Node >= 18.18; this is ${process.version}).`,
  );
}

for (const file of files) {
  await import(pathToFileURL(file).href);
}

const { run } = await import(
  pathToFileURL(path.join(ROOT, "test/helpers/test.js")).href
);
const failed = await run();
process.exit(failed ? 1 : 0);

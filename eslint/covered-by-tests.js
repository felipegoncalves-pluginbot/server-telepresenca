import fs from "node:fs";
import path from "node:path";
import { listFiles } from "./walk-files.js";

const IMPORT_FROM = /\bfrom\s+["'](\.[^"']+)["']/g;

/**
 * Absolute paths of modules imported (relatively) from `*.test.js` files.
 * @param {string} cwd
 * @returns {Set<string>}
 */
export function modulesImportedByTests(cwd) {
  const covered = new Set();
  const tests = listFiles(path.join(cwd, "test"), (name) => name.endsWith(".test.js"));
  for (const testFile of tests) {
    const text = fs.readFileSync(testFile, "utf8");
    for (const match of text.matchAll(IMPORT_FROM)) {
      const resolved = path.normalize(path.resolve(path.dirname(testFile), match[1]));
      covered.add(resolved);
    }
  }
  return covered;
}

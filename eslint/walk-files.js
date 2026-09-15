import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} dir
 * @param {(name: string, full: string) => boolean} predicate
 * @param {string[]} [acc]
 * @returns {string[]}
 */
export function listFiles(dir, predicate, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, predicate, acc);
    else if (predicate(entry.name, full)) acc.push(full);
  }
  return acc;
}

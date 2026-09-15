#!/usr/bin/env node
/**
 * Semgrep-compatible checks that run on Node 16 when the Semgrep CLI is absent.
 * Same intent as .semgrep.yml: no brand branches, no ICE in the operator UI, no eval.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) acc.push(full);
  }
  return acc;
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

const brand =
  /(?:===|==)\s*["'](?:cruzr|sanbot|cruzr-1s|sanbot-elf)["']|["'](?:cruzr|sanbot|cruzr-1s|sanbot-elf)["']\s*(?:===|==)|robotModel\s*===/;
const ice = /(turns?:|stun:|ICE_SERVERS|metered\.ca)/i;
const evalCall = /\beval\s*\(|\bnew\s+Function\s*\(/;

const findings = [];

for (const file of walk(path.join(ROOT, "public/js"))) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    if (brand.test(line)) {
      findings.push(`${rel(file)}:${index + 1}: brand branch (use capabilities)`);
    }
    if (ice.test(line)) {
      findings.push(`${rel(file)}:${index + 1}: STUN/TURN must not live in public/js`);
    }
    if (evalCall.test(line)) {
      findings.push(`${rel(file)}:${index + 1}: eval/Function is forbidden`);
    }
  });
}

for (const file of walk(path.join(ROOT, "src"))) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    if (evalCall.test(line)) {
      findings.push(`${rel(file)}:${index + 1}: eval/Function is forbidden`);
    }
  });
}

if (findings.length) {
  console.error("Semgrep fallback failed:\n");
  for (const item of findings) console.error(`  ${item}`);
  process.exit(1);
}

console.log("semgrep fallback ok (no brand branches, no ICE in UI, no eval)");

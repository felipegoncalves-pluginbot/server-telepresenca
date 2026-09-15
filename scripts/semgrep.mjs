#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fallback = path.join(ROOT, "scripts/semgrep-fallback.mjs");

const cli = spawnSync(
  "semgrep",
  ["--config", ".semgrep.yml", "--error", "--quiet", "public/js", "src"],
  { cwd: ROOT, encoding: "utf8" },
);

if (cli.error && cli.error.code === "ENOENT") {
  const result = spawnSync(process.execPath, [fallback], {
    cwd: ROOT,
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

if (cli.stdout) process.stdout.write(cli.stdout);
if (cli.stderr) process.stderr.write(cli.stderr);
process.exit(cli.status ?? 1);

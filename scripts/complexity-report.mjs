#!/usr/bin/env node
/**
 * Advisory complexity report (radon/xenon analogue).
 * Reads ESLint JSON and prints cyclomatic / cognitive hotspots.
 * Exit 0 unless ESLint itself fails to run.
 */
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["eslint", ".", "-f", "json", "--no-error-on-unmatched-pattern"],
  { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

let reports;
try {
  reports = JSON.parse(result.stdout || "[]");
} catch (_err) {
  console.error("Failed to parse ESLint JSON");
  console.error(result.stderr);
  process.exit(1);
}

const ranks = [
  { name: "A", max: 5 },
  { name: "B", max: 10 },
  { name: "C", max: 20 },
  { name: "D", max: 30 },
  { name: "E", max: 40 },
  { name: "F", max: Infinity },
];

function rankFor(score) {
  return ranks.find((item) => score <= item.max).name;
}

const hotspots = [];
for (const file of reports) {
  for (const message of file.messages || []) {
    if (
      message.ruleId === "complexity" ||
      message.ruleId === "sonarjs/cognitive-complexity" ||
      message.ruleId === "max-lines" ||
      message.ruleId === "max-lines-per-function"
    ) {
      const match = String(message.message).match(/(\d+)/);
      const score = match ? Number(match[1]) : 0;
      hotspots.push({
        file: file.filePath.replace(`${process.cwd()}/`, ""),
        line: message.line,
        rule: message.ruleId,
        score,
        rank: rankFor(score),
      });
    }
  }
}

hotspots.sort((a, b) => b.score - a.score);
console.log("Complexity hotspots (advisory)\n");
if (hotspots.length === 0) {
  console.log("No complexity warnings.");
} else {
  for (const item of hotspots.slice(0, 40)) {
    console.log(
      `${item.rank.padEnd(2)} ${String(item.score).padStart(4)}  ${item.rule}  ${item.file}:${item.line}`,
    );
  }
  console.log(`\n${hotspots.length} hotspot(s). Not a CI gate.`);
}

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "../helpers/test.js";
import { lintCssDirectory } from "../../scripts/lint-css.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const publicDir = path.join(rootDir, "public");

test("public/ CSS files comply with 400-line limit, design tokens, and pixel perfection", () => {
  const result = lintCssDirectory(publicDir, 400);
  assert.equal(
    result.valid,
    true,
    `CSS layout/token/max-lines errors:\n${result.errors.map((e) => ` - ${e}`).join("\n")}`,
  );
});

test("controls.css declares Discord-style icon rotation keyframes and rules", () => {
  const controlsCssPath = path.join(publicDir, "css/controls.css");
  const content = fs.readFileSync(controlsCssPath, "utf8");

  // Happy Path: Keyframes declaration with left (-12deg) then right (+10deg)
  assert.match(
    content,
    /@keyframes\s+discord-icon-rotate[\s\S]*?rotate\(-12deg\)[\s\S]*?rotate\(10deg\)/,
    "controls.css must declare @keyframes discord-icon-rotate with left and right rotation steps",
  );

  // Happy Path: Binding on hover svg, excluding disabled and is-ringing
  assert.match(
    content,
    /\.ctrl:hover:not\(:disabled\):not\(\.is-ringing\)\s+svg\s*\{[^}]*animation:[^}]*discord-icon-rotate/s,
    "controls.css must apply discord-icon-rotate to .ctrl:hover:not(:disabled):not(.is-ringing) svg",
  );

  // Fallback / Reduced motion protection
  assert.match(
    content,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.ctrl[^}]*animation:\s*none\s*!important/s,
    "Reduced motion must disable animations on .ctrl",
  );
});

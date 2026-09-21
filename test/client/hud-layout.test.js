import assert from "node:assert/strict";
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

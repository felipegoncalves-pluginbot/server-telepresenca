import assert from "node:assert/strict";
import path from "node:path";
import { test } from "../helpers/test.js";
import { RuleTester } from "eslint";
import plugin from "../../eslint/plugin-require-tests.js";

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

test("imported-from-test requires a *.test.js import of the module", () => {
  const cwd = process.cwd();
  assert.doesNotThrow(() => {
    tester.run("imported-from-test", plugin.rules["imported-from-test"], {
      valid: [
        {
          code: "export function loadConfig() {}",
          filename: path.join(cwd, "src/config.js"),
        },
      ],
      invalid: [
        {
          code: "export const untouched = 1;",
          filename: path.join(cwd, "src/definitely-untested.js"),
          errors: [{ messageId: "missing" }],
        },
      ],
    });
  });
});

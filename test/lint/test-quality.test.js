import assert from "node:assert/strict";
import { RuleTester } from "eslint";
import plugin from "../../eslint/plugin-test-quality.js";
import { test } from "../helpers/test.js";

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

const validTest = `import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
test("adds", () => { assert.equal(1 + 1, 2); });
`;

test("test-quality accepts a helper-based file with strict assertions", () => {
  assert.doesNotThrow(() => {
    tester.run("use-node-test", plugin.rules["use-node-test"], {
      valid: [{ code: validTest }],
      invalid: [
        {
          code: `import assert from "node:assert/strict";\n`,
          errors: [{ messageId: "missing" }],
        },
      ],
    });
    tester.run("use-strict-assert", plugin.rules["use-strict-assert"], {
      valid: [{ code: validTest }],
      invalid: [
        {
          code: `import { test } from "../helpers/test.js";\ntest("x", () => {});\n`,
          errors: [{ messageId: "missing" }],
        },
      ],
    });
    tester.run("has-test", plugin.rules["has-test"], {
      valid: [{ code: validTest }],
      invalid: [
        {
          code: `import { test } from "../helpers/test.js";\nimport assert from "node:assert/strict";\n`,
          errors: [{ messageId: "missing" }],
        },
      ],
    });
    tester.run("require-assertions", plugin.rules["require-assertions"], {
      valid: [{ code: validTest }],
      invalid: [
        {
          code: `import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
test("empty", () => {});
`,
          errors: [{ messageId: "missing" }],
        },
      ],
    });
    tester.run("no-focused", plugin.rules["no-focused"], {
      valid: [{ code: validTest }],
      invalid: [
        {
          code: `import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
test.only("focused", () => { assert.ok(true); });
`,
          errors: [{ messageId: "focused" }],
        },
      ],
    });
    tester.run("no-disabled", plugin.rules["no-disabled"], {
      valid: [{ code: validTest }],
      invalid: [
        {
          code: `import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
test.skip("skipped", () => { assert.ok(true); });
`,
          errors: [{ messageId: "disabled" }],
        },
      ],
    });
    tester.run("unique-titles", plugin.rules["unique-titles"], {
      valid: [{ code: validTest }],
      invalid: [
        {
          code: `import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
test("dup", () => { assert.ok(true); });
test("dup", () => { assert.ok(1); });
`,
          errors: [{ messageId: "duplicate" }],
        },
      ],
    });
  });
});

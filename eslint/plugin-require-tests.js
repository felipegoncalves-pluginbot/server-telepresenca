import path from "node:path";
import { modulesImportedByTests } from "./covered-by-tests.js";

const cache = new Map();

function coveredFor(cwd) {
  let set = cache.get(cwd);
  if (!set) {
    set = modulesImportedByTests(cwd);
    cache.set(cwd, set);
  }
  return set;
}

const importedFromTest = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a unit/regression test file to import this production module.",
    },
    schema: [],
    messages: {
      missing:
        "No test imports this module. Add a *.test.js file that imports '{{file}}'. npm test discovers those files automatically.",
    },
  },
  create(context) {
    return {
      Program(node) {
        const cwd = context.cwd || process.cwd();
        const file = path.normalize(context.filename);
        if (coveredFor(cwd).has(file)) return;
        const rel = path.relative(cwd, file).replaceAll("\\", "/");
        context.report({ node, messageId: "missing", data: { file: rel } });
      },
    };
  },
};

export default {
  meta: { name: "require-tests" },
  rules: { "imported-from-test": importedFromTest },
};

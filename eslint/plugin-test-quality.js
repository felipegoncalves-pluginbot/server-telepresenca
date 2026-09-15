import {
  classifyNodeTestImport,
  hasAssertCall,
  importLocals,
  isNamedCallee,
  optionMode,
  staticTitle,
  testCallback,
} from "./test-ast.js";

function reportIfMissing(context, used, program, messageId) {
  if (!used) context.report({ node: program, messageId });
}

const useNodeTest = {
  meta: {
    type: "problem",
    docs: {
      description: "Test files must import the Node 16-compatible test helper.",
    },
    schema: [],
    messages: {
      missing:
        'Import { test } from "../helpers/test.js". npm test discovers *.test.js on Node 16 and on current Node.',
    },
  },
  create(context) {
    let used = false;
    return {
      ImportDeclaration(node) {
        if (/(?:^|\/)helpers\/test\.js$/.test(node.source.value)) used = true;
      },
      "Program:exit"(node) {
        reportIfMissing(context, used, node, "missing");
      },
    };
  },
};

const useStrictAssert = {
  meta: {
    type: "problem",
    docs: { description: "Test files must import node:assert/strict." },
    schema: [],
    messages: {
      missing: 'Import assert from "node:assert/strict" and use it in every test.',
    },
  },
  create(context) {
    let used = false;
    return {
      ImportDeclaration(node) {
        if (node.source.value === "node:assert/strict") used = true;
      },
      "Program:exit"(node) {
        reportIfMissing(context, used, node, "missing");
      },
    };
  },
};

const hasTest = {
  meta: {
    type: "problem",
    docs: { description: "A *.test.js file must register at least one test()." },
    schema: [],
    messages: {
      missing: "This file is named *.test.js but never calls test() or it().",
    },
  },
  create(context) {
    const cases = new Set();
    let count = 0;
    return {
      ImportDeclaration(node) {
        for (const name of classifyNodeTestImport(node).cases) cases.add(name);
      },
      CallExpression(node) {
        if (isNamedCallee(node.callee, cases)) count += 1;
      },
      "Program:exit"(node) {
        if (count === 0) context.report({ node, messageId: "missing" });
      },
    };
  },
};

const requireAssertions = {
  meta: {
    type: "problem",
    docs: { description: "Each test must contain an assertion or it cannot fail." },
    schema: [],
    messages: {
      missing:
        "Test '{{title}}' has no assert.* call. A test without assertions always passes.",
    },
  },
  create(context) {
    const cases = new Set();
    const asserts = new Set();
    return {
      ImportDeclaration(node) {
        for (const name of classifyNodeTestImport(node).cases) cases.add(name);
        for (const name of importLocals(node, "node:assert/strict")) {
          asserts.add(name);
        }
      },
      CallExpression(node) {
        if (!isNamedCallee(node.callee, cases)) return;
        if (optionMode(node) === "todo") return;
        const fn = testCallback(node);
        if (fn && hasAssertCall(fn, asserts)) return;
        const title = staticTitle(node.arguments[0]) || "(unnamed)";
        context.report({ node, messageId: "missing", data: { title } });
      },
    };
  },
};

function collectImportedTestNames(names) {
  return {
    ImportDeclaration(node) {
      const classified = classifyNodeTestImport(node);
      for (const name of classified.cases) names.add(name);
      for (const name of classified.suites) names.add(name);
    },
  };
}

function createModeRule(messageId, description, isBad) {
  return {
    meta: {
      type: "problem",
      docs: { description },
      schema: [],
      messages: { [messageId]: description },
    },
    create(context) {
      const names = new Set();
      return {
        ...collectImportedTestNames(names),
        CallExpression(node) {
          const info = isNamedCallee(node.callee, names);
          if (!info || !isBad(info.method, optionMode(node))) return;
          context.report({ node, messageId });
        },
      };
    },
  };
}

const noFocused = createModeRule(
  "focused",
  "Remove .only / { only: true }. npm test must run every unit and regression test.",
  (method, option) => method === "only" || option === "only",
);

const noDisabled = createModeRule(
  "disabled",
  "Remove .skip / .todo. A disabled test does not protect the regression.",
  (method, option) => {
    const mode = method || option;
    return mode === "skip" || mode === "todo";
  },
);

const uniqueTitles = {
  meta: {
    type: "problem",
    docs: { description: "Test titles in a file must be unique." },
    schema: [],
    messages: {
      duplicate: "Duplicate test title '{{title}}'. Failures would be ambiguous.",
    },
  },
  create(context) {
    const cases = new Set();
    const seen = new Map();
    return {
      ImportDeclaration(node) {
        for (const name of classifyNodeTestImport(node).cases) cases.add(name);
      },
      CallExpression(node) {
        if (!isNamedCallee(node.callee, cases)) return;
        const title = staticTitle(node.arguments[0]);
        if (!title) return;
        if (seen.has(title)) {
          context.report({ node, messageId: "duplicate", data: { title } });
          return;
        }
        seen.set(title, node);
      },
    };
  },
};

export default {
  meta: { name: "test-quality" },
  rules: {
    "use-node-test": useNodeTest,
    "use-strict-assert": useStrictAssert,
    "has-test": hasTest,
    "require-assertions": requireAssertions,
    "no-focused": noFocused,
    "no-disabled": noDisabled,
    "unique-titles": uniqueTitles,
  },
};

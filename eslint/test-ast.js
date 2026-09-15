/**
 * @param {{ source: { value: string }, specifiers: object[] }} node
 * @param {string} source
 * @returns {string[]}
 */
export function importLocals(node, source) {
  if (node.source.value !== source) return [];
  return node.specifiers.map((spec) => spec.local.name);
}

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isTestRunnerSource(source) {
  return source === "node:test" || /(?:^|\/)helpers\/test\.js$/.test(String(source));
}

/**
 * @param {{ source: { value: string }, specifiers: object[] }} node
 * @returns {{ cases: Set<string>, suites: Set<string> }}
 */
export function classifyNodeTestImport(node) {
  const cases = new Set();
  const suites = new Set();
  if (!isTestRunnerSource(node.source.value)) return { cases, suites };
  for (const spec of node.specifiers) {
    if (spec.type === "ImportDefaultSpecifier") {
      cases.add(spec.local.name);
      continue;
    }
    if (spec.type !== "ImportSpecifier") continue;
    const imported =
      spec.imported.type === "Identifier" ? spec.imported.name : spec.imported.value;
    if (imported === "describe" || imported === "suite") {
      suites.add(spec.local.name);
    } else if (imported === "test" || imported === "it") {
      cases.add(spec.local.name);
    }
  }
  return { cases, suites };
}

/**
 * @param {unknown} node
 * @param {(node: { type: string }) => void} visit
 */
export function walkAst(node, visit) {
  if (!node || typeof node !== "object") return;
  const ast = /** @type {{ type?: string, parent?: unknown }} */ (node);
  if (!ast.type) return;
  visit(ast);
  for (const [key, value] of Object.entries(ast)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) {
      for (const child of value) walkAst(child, visit);
    } else {
      walkAst(value, visit);
    }
  }
}

/**
 * @param {{ type: string, name?: string, computed?: boolean, object?: object, property?: object }} callee
 * @param {Set<string>} names
 * @returns {{ method: string | null } | null}
 */
export function isNamedCallee(callee, names) {
  if (callee.type === "Identifier") {
    return names.has(callee.name) ? { method: null } : null;
  }
  if (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    names.has(callee.object.name) &&
    callee.property.type === "Identifier"
  ) {
    return { method: callee.property.name };
  }
  return null;
}

/**
 * @param {{ type: string, value?: unknown, expressions?: unknown[], quasis?: object[] } | undefined} arg
 * @returns {string | null}
 */
export function staticTitle(arg) {
  if (!arg) return null;
  if (arg.type === "Literal" && typeof arg.value === "string") return arg.value;
  if (arg.type === "TemplateLiteral" && arg.expressions.length === 0) {
    return arg.quasis[0].value.cooked || "";
  }
  return null;
}

/**
 * @param {{ arguments: object[] }} call
 * @returns {object | null}
 */
export function testCallback(call) {
  for (let i = call.arguments.length - 1; i >= 1; i -= 1) {
    const arg = call.arguments[i];
    if (arg.type === "ArrowFunctionExpression" || arg.type === "FunctionExpression") {
      return arg;
    }
  }
  return null;
}

/**
 * @param {{ arguments: object[] }} call
 * @returns {string | null}
 */
export function optionMode(call) {
  const arg = call.arguments[1];
  if (!arg || arg.type !== "ObjectExpression") return null;
  for (const prop of arg.properties) {
    if (prop.type !== "Property" || prop.computed) continue;
    const key = prop.key.type === "Identifier" ? prop.key.name : prop.key.value;
    if (key !== "only" && key !== "skip" && key !== "todo") continue;
    if (prop.value.type === "Literal" && prop.value.value === false) continue;
    return String(key);
  }
  return null;
}

/**
 * @param {object} root
 * @param {Set<string>} assertNames
 * @returns {boolean}
 */
export function hasAssertCall(root, assertNames) {
  let found = false;
  walkAst(root, (node) => {
    if (found || node.type !== "CallExpression") return;
    const callee = /** @type {{ callee: object }} */ (node).callee;
    if (callee.type === "Identifier" && assertNames.has(callee.name)) {
      found = true;
      return;
    }
    if (
      callee.type === "MemberExpression" &&
      callee.object.type === "Identifier" &&
      assertNames.has(callee.object.name)
    ) {
      found = true;
    }
  });
  return found;
}

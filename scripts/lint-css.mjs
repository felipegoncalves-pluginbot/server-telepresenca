#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HUD_CHIP_SELECTORS = [
  ".status-chip",
  ".power-chip",
  ".session-countdown",
  ".lang-current",
];

export const REQUIRED_ROOT_TOKENS = ["--hud-chip-height"];
export const MAX_CSS_LINES = 400;

/**
 * Remove comments and normalize whitespace.
 * @param {string} css
 * @returns {string}
 */
export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Extract rules blocks matching selector.
 * @param {string} cleanCss
 * @param {string} selector
 * @returns {string[]}
 */
export function extractRuleBodies(cleanCss, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?:^|[},\\s])${escaped}\\s*\\{([^}]+)\\}`, "g");
  const bodies = [];
  let match;
  while ((match = regex.exec(cleanCss)) !== null) {
    bodies.push(match[1]);
  }
  return bodies;
}

/**
 * Parse declarations into key-value pairs.
 * @param {string} body
 * @returns {Record<string, string>}
 */
export function parseDeclarations(body) {
  const declarations = {};
  const statements = body.split(";");
  for (const stmt of statements) {
    const colonIdx = stmt.indexOf(":");
    if (colonIdx === -1) continue;
    const prop = stmt.slice(0, colonIdx).trim().toLowerCase();
    const val = stmt.slice(colonIdx + 1).trim();
    if (prop) declarations[prop] = val;
  }
  return declarations;
}

/**
 * Check root token declarations.
 * @param {string} cleanCss
 * @returns {string[]} errors
 */
function checkRootTokens(cleanCss) {
  const errors = [];
  const rootBodies = extractRuleBodies(cleanCss, ":root");
  if (rootBodies.length === 0) {
    errors.push(":root block not found in stylesheet");
    return errors;
  }
  const rootProps = Object.assign({}, ...rootBodies.map(parseDeclarations));
  for (const token of REQUIRED_ROOT_TOKENS) {
    const val = rootProps[token];
    if (!val) {
      errors.push(`Missing mandatory token '${token}' in :root`);
    } else if (!/^(?:\d+px|\d+rem)$/.test(val)) {
      errors.push(`Token '${token}' has invalid format '${val}'`);
    }
  }
  return errors;
}

/**
 * Check a single chip selector.
 * @param {string} cleanCss
 * @param {string} selector
 * @returns {string[]} errors
 */
function checkChipSelector(cleanCss, selector) {
  const errors = [];
  const bodies = extractRuleBodies(cleanCss, selector);
  if (bodies.length === 0) {
    errors.push(`Selector '${selector}' is missing in stylesheet`);
    return errors;
  }
  const mainProps = parseDeclarations(bodies[0]);
  const heightVal = mainProps["height"];

  if (!heightVal) {
    errors.push(
      `'${selector}' must define explicit 'height' to prevent vertical mismatch`,
    );
  } else if (!heightVal.includes("var(--hud-chip-height)")) {
    errors.push(
      `'${selector}' must use 'var(--hud-chip-height)' instead of '${heightVal}'`,
    );
  }

  return errors;
}

/**
 * Check if a file exceeds maximum allowed lines.
 * @param {string} filePath
 * @param {string} content
 * @param {number} [max]
 * @returns {string | null}
 */
export function checkFileMaxLines(filePath, content, max = MAX_CSS_LINES) {
  const lines = content.split("\n").length;
  if (lines > max) {
    return `File '${filePath}' has ${lines} lines, exceeding the ${max}-line limit`;
  }
  return null;
}

/**
 * Recursively find all CSS files in a directory.
 * @param {string} dir
 * @param {string[]} [acc]
 * @returns {string[]}
 */
export function findCssFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findCssFiles(full, acc);
    else if (entry.name.endsWith(".css")) acc.push(full);
  }
  return acc;
}

/**
 * Extract @import target paths from CSS content.
 * @param {string} content
 * @returns {string[]}
 */
export function extractImportPaths(content) {
  const regex = /@import\s+(?:url\(['"]?([^'")]+)['"]?\)|['"]([^'"]+)['"]);?/g;
  const paths = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    paths.push(m[1] || m[2]);
  }
  return paths;
}

/**
 * Recursively resolve @import statements into combined CSS.
 * @param {string} entryPath
 * @param {Set<string>} [visited]
 * @returns {{ css: string, errors: string[] }}
 */
export function resolveImports(entryPath, visited = new Set()) {
  if (visited.has(entryPath)) return { css: "", errors: [] };
  visited.add(entryPath);

  if (!fs.existsSync(entryPath)) {
    return { css: "", errors: [`Imported file not found: '${entryPath}'`] };
  }

  const content = fs.readFileSync(entryPath, "utf8");
  const importPaths = extractImportPaths(content);
  const errors = [];
  let combined = "";

  for (const relPath of importPaths) {
    if (/^https?:\/\//i.test(relPath)) {
      errors.push(`Remote import forbidden: '${relPath}'`);
      continue;
    }
    const absPath = path.resolve(path.dirname(entryPath), relPath);
    const sub = resolveImports(absPath, visited);
    errors.push(...sub.errors);
    combined += sub.css + "\n";
  }

  const stripped = content.replace(/@import\s+[^;]+;?/g, "");
  combined += stripped + "\n";
  return { css: combined, errors };
}

/**
 * Lint CSS string for HUD pixel-perfect rules and design tokens.
 * @param {string} css
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function lintCss(css) {
  const clean = stripComments(css);
  const errors = [];

  errors.push(...checkRootTokens(clean));

  for (const selector of HUD_CHIP_SELECTORS) {
    errors.push(...checkChipSelector(clean, selector));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Lint an entire directory of CSS files for max-lines and tokens.
 * @param {string} dirPath
 * @param {number} [maxLines]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function lintCssDirectory(dirPath, maxLines = MAX_CSS_LINES) {
  const errors = [];
  const files = findCssFiles(dirPath);

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lineErr = checkFileMaxLines(file, content, maxLines);
    if (lineErr) errors.push(lineErr);
  }

  const mainStyle = path.join(dirPath, "style.css");
  if (fs.existsSync(mainStyle)) {
    const { css, errors: importErrors } = resolveImports(mainStyle);
    errors.push(...importErrors);
    const tokenLint = lintCss(css);
    errors.push(...tokenLint.errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * CLI execution entrypoint
 */
export function main() {
  const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const publicDir = path.join(rootDir, "public");
  const result = lintCssDirectory(publicDir, MAX_CSS_LINES);

  if (!result.valid) {
    console.error("❌ CSS Design Token & Max-Lines Linter failed:");
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log("✔ CSS Design Tokens, Max-Lines (<= 400) & Pixel-Perfect checks passed.");
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import {
  lintCss,
  checkFileMaxLines,
  extractImportPaths,
  resolveImports,
} from "../../scripts/lint-css.mjs";

const VALID_CSS = `
:root {
  --hud-chip-height: 32px;
}
.status-chip {
  height: var(--hud-chip-height);
  box-sizing: border-box;
}
.power-chip {
  height: var(--hud-chip-height);
  box-sizing: border-box;
}
.session-countdown {
  height: var(--hud-chip-height);
  box-sizing: border-box;
}
.lang-current {
  height: var(--hud-chip-height);
  box-sizing: border-box;
}
`;

test("lintCss passes when tokens and heights are properly declared", () => {
  const res = lintCss(VALID_CSS);
  assert.equal(res.valid, true);
  assert.equal(res.errors.length, 0);
});

test("lintCss fails when --hud-chip-height is missing in :root", () => {
  const css = `
  :root { --other: 10px; }
  .status-chip { height: var(--hud-chip-height); }
  .power-chip { height: var(--hud-chip-height); }
  .session-countdown { height: var(--hud-chip-height); }
  .lang-current { height: var(--hud-chip-height); }
  `;
  const res = lintCss(css);
  assert.equal(res.valid, false);
  assert.ok(
    res.errors.some((e) => e.includes("Missing mandatory token '--hud-chip-height'")),
  );
});

test("lintCss fails when a chip uses hardcoded height instead of token", () => {
  const css = `
  :root { --hud-chip-height: 32px; }
  .status-chip { height: var(--hud-chip-height); }
  .power-chip { height: var(--hud-chip-height); }
  .session-countdown { height: var(--hud-chip-height); }
  .lang-current { height: 32px; }
  `;
  const res = lintCss(css);
  assert.equal(res.valid, false);
  assert.ok(
    res.errors.some((e) =>
      e.includes("'.lang-current' must use 'var(--hud-chip-height)'"),
    ),
  );
});

test("lintCss fails when a chip has no explicit height declaration", () => {
  const css = `
  :root { --hud-chip-height: 32px; }
  .status-chip { padding: 6px 12px; }
  .power-chip { height: var(--hud-chip-height); }
  .session-countdown { height: var(--hud-chip-height); }
  .lang-current { height: var(--hud-chip-height); }
  `;
  const res = lintCss(css);
  assert.equal(res.valid, false);
  assert.ok(
    res.errors.some((e) => e.includes("'.status-chip' must define explicit 'height'")),
  );
});

test("lintCss fails when a chip selector is entirely missing", () => {
  const css = `
  :root { --hud-chip-height: 32px; }
  .status-chip { height: var(--hud-chip-height); }
  .power-chip { height: var(--hud-chip-height); }
  .lang-current { height: var(--hud-chip-height); }
  `;
  const res = lintCss(css);
  assert.equal(res.valid, false);
  assert.ok(
    res.errors.some((e) => e.includes("Selector '.session-countdown' is missing")),
  );
});

test("checkFileMaxLines permits files within the limit", () => {
  const content = "line\n".repeat(50);
  const err = checkFileMaxLines("test.css", content, 400);
  assert.equal(err, null);
});

test("checkFileMaxLines rejects files exceeding 400 lines", () => {
  const content = "line\n".repeat(405);
  const err = checkFileMaxLines("huge.css", content, 400);
  assert.ok(err !== null);
  assert.ok(err.includes("406 lines, exceeding the 400-line limit"));
});

test("extractImportPaths extracts various import syntaxes", () => {
  const css = `
    @import "./tokens.css";
    @import url("hud.css");
    @import 'controls.css';
  `;
  const paths = extractImportPaths(css);
  assert.deepEqual(paths, ["./tokens.css", "hud.css", "controls.css"]);
});

test("resolveImports rejects remote http imports for security", () => {
  const res = resolveImports("/nonexistent/fake-entry.css");
  assert.ok(res.errors.length > 0);
});

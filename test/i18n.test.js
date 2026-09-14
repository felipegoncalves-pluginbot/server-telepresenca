const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const localesDir = path.join(root, "public", "locales");
const publicDir = path.join(root, "public");

const localeFiles = fs
  .readdirSync(localesDir)
  .filter((file) => file.endsWith(".json"))
  .sort();

assert.ok(localeFiles.length >= 2, "expected at least two locale files");

const tables = {};
for (const file of localeFiles) {
  const raw = fs.readFileSync(path.join(localesDir, file), "utf8");
  tables[file] = JSON.parse(raw);
}

const referenceName = localeFiles.includes("pt-BR.json")
  ? "pt-BR.json"
  : localeFiles[0];
const referenceKeys = Object.keys(tables[referenceName]).sort();
assert.ok(referenceKeys.length > 0, "reference locale has no keys");

for (const file of localeFiles) {
  const keys = Object.keys(tables[file]).sort();
  assert.deepStrictEqual(
    keys,
    referenceKeys,
    `locale ${file} keys differ from ${referenceName}`,
  );
  for (const key of keys) {
    const value = tables[file][key];
    assert.strictEqual(
      typeof value,
      "string",
      `${file} ${key} must be a string`,
    );
    assert.ok(value.trim().length > 0, `${file} ${key} is empty`);
  }
}

function tokens(value) {
  return (String(value).match(/\{\{\w+\}\}/g) || []).sort();
}

for (const key of referenceKeys) {
  const expected = tokens(tables[referenceName][key]);
  for (const file of localeFiles) {
    assert.deepStrictEqual(
      tokens(tables[file][key]),
      expected,
      `interpolation mismatch for ${key} in ${file}`,
    );
  }
}

const html = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
const jsSources = ["app.js", "i18n.js", "joystick.js", "video-quality.js"]
  .map((file) => fs.readFileSync(path.join(publicDir, file), "utf8"))
  .join("\n");

const htmlKeys = new Set();
for (const match of html.matchAll(/data-i18n(?:-title|-aria|-alt)?="([^"]+)"/g)) {
  htmlKeys.add(match[1]);
}

for (const key of htmlKeys) {
  assert.ok(
    referenceKeys.includes(key),
    `HTML references missing i18n key: ${key}`,
  );
}

const codeKeys = new Set();
for (const match of jsSources.matchAll(/\bt\(\s*["']([^"']+)["']/g)) {
  codeKeys.add(match[1]);
}
for (const match of jsSources.matchAll(/TeleI18n\.t\(\s*["']([^"']+)["']/g)) {
  codeKeys.add(match[1]);
}
for (const match of jsSources.matchAll(
  /set(?:Status|Placeholder)\(\s*["']([^"']+)["']/g,
)) {
  codeKeys.add(match[1]);
}

for (const key of codeKeys) {
  assert.ok(
    referenceKeys.includes(key),
    `JS references missing i18n key: ${key}`,
  );
}

const usedKeys = new Set([...htmlKeys, ...codeKeys]);
for (const match of jsSources.matchAll(
  /["']((?:status|call|media|movement|room|rtc|brand|app|lang|video)[.][^"']+)["']/g,
)) {
  usedKeys.add(match[1]);
}

const unused = referenceKeys.filter(
  (key) => !usedKeys.has(key) && !key.startsWith("lang."),
);
assert.deepStrictEqual(unused, [], `unused i18n keys: ${unused.join(", ")}`);

assert.ok(
  !html.includes("btnConnect") && !html.includes(">Conectar<"),
  "Connect button should be removed from the operator HUD",
);
assert.ok(!html.includes("btnUnmuteAudio"), "unmute overlay must be removed");
assert.ok(!html.includes("Ativar som"), "unmute CTA must be removed");
assert.ok(html.includes("kbd-hint"), "desktop key hint missing");
assert.ok(html.includes("assets/flags/br.png"), "language flags missing");
assert.ok(
  html.includes("M12 9c-1.6 0-3.15.25-4.6.72v3.1"),
  "hangup icon must use the call-end glyph",
);
assert.ok(
  !jsSources.includes("status.commandSent"),
  "command-sent status popup must be gone",
);

const forbidden = [
  "Conectar",
  "Encerrar",
  "Painel do operador",
  "Mic: ligado",
  "Câm: ligada",
];
for (const phrase of forbidden) {
  assert.ok(
    !jsSources.includes(`"${phrase}"`) && !jsSources.includes(`'${phrase}'`),
    `hardcoded UI string in JS: ${phrase}`,
  );
}

console.log(
  `i18n ok: ${localeFiles.length} locales, ${referenceKeys.length} keys, ${htmlKeys.size} html, ${codeKeys.size} js`,
);

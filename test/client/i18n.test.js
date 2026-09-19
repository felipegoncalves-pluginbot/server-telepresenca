import assert from "node:assert/strict";
import { test } from "../helpers/test.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { i18n } from "../../public/js/i18n/index.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const localesDir = path.join(root, "public", "locales");
const publicDir = path.join(root, "public");

function listJs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJs(full));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

test("locale files share keys and interpolation tokens", () => {
  const localeFiles = fs
    .readdirSync(localesDir)
    .filter((file) => file.endsWith(".json"))
    .sort();
  assert.ok(localeFiles.length >= 2, "expected at least two locale files");

  const tables = {};
  for (const file of localeFiles) {
    tables[file] = JSON.parse(fs.readFileSync(path.join(localesDir, file), "utf8"));
  }

  const referenceName = localeFiles.includes("pt-BR.json")
    ? "pt-BR.json"
    : localeFiles[0];
  const referenceKeys = Object.keys(tables[referenceName]).sort();
  assert.ok(referenceKeys.length > 0, "reference locale has no keys");

  for (const file of localeFiles) {
    const keys = Object.keys(tables[file]).sort();
    assert.deepEqual(
      keys,
      referenceKeys,
      `locale ${file} keys differ from ${referenceName}`,
    );
    for (const key of keys) {
      const value = tables[file][key];
      assert.equal(typeof value, "string", `${file} ${key} must be a string`);
      assert.ok(value.trim().length > 0, `${file} ${key} is empty`);
    }
  }

  function tokens(value) {
    return (String(value).match(/\{\{\w+\}\}/g) || []).sort();
  }

  for (const key of referenceKeys) {
    const expected = tokens(tables[referenceName][key]);
    for (const file of localeFiles) {
      assert.deepEqual(
        tokens(tables[file][key]),
        expected,
        `interpolation mismatch for ${key} in ${file}`,
      );
    }
  }

  const html = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
  const jsSources = listJs(path.join(publicDir, "js"))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");

  const htmlKeys = new Set();
  for (const match of html.matchAll(/data-i18n(?:-title|-aria|-alt)?="([^"]+)"/g)) {
    htmlKeys.add(match[1]);
  }
  for (const key of htmlKeys) {
    assert.ok(referenceKeys.includes(key), `HTML references missing i18n key: ${key}`);
  }

  const codeKeys = new Set();
  for (const match of jsSources.matchAll(/\bt\(\s*["']([^"']+)["']/g)) {
    codeKeys.add(match[1]);
  }
  for (const match of jsSources.matchAll(/i18n\.t\(\s*["']([^"']+)["']/g)) {
    codeKeys.add(match[1]);
  }
  for (const match of jsSources.matchAll(
    /set(?:Status|Placeholder)\(\s*["']([^"']+)["']/g,
  )) {
    codeKeys.add(match[1]);
  }
  for (const key of codeKeys) {
    assert.ok(referenceKeys.includes(key), `JS references missing i18n key: ${key}`);
  }

  const usedKeys = new Set([...htmlKeys, ...codeKeys]);
  for (const match of jsSources.matchAll(
    /["']((?:status|call|media|movement|room|rtc|brand|app|lang|video|power|volume|invite)[.][^"']+)["']/g,
  )) {
    usedKeys.add(match[1]);
  }

  const unused = referenceKeys.filter(
    (key) => !usedKeys.has(key) && !key.startsWith("lang."),
  );
  assert.deepEqual(unused, [], `unused i18n keys: ${unused.join(", ")}`);

  assert.ok(html.includes("js/main.js"), "operator must boot from js/main.js");
  assert.ok(html.includes("<title>TelePlugin</title>"));
  assert.ok(html.includes("assets/favicon.svg"));
  assert.ok(html.includes("hud-popover"));
  assert.ok(html.includes("hud-popover-head"));
  assert.ok(fs.existsSync(path.join(publicDir, "assets/favicon.svg")));
  assert.ok(!html.includes("btnConnect") && !html.includes(">Conectar<"));
  assert.ok(html.includes("kbd-hint"));
  assert.ok(html.includes("assets/flags/br.png"));
  assert.ok(html.includes("M12 9c-1.6 0-3.15.25-4.6.72v3.1"));
  assert.ok(!jsSources.includes("status.commandSent"));

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
});

test("i18n.t interpolates tokens and falls back to the key", () => {
  const previousTable = i18n.messages["pt-BR"];
  const previousLocale = i18n.locale;
  i18n.messages["pt-BR"] = { "hello.name": "Olá {{name}}" };
  i18n.locale = "pt-BR";
  try {
    assert.equal(i18n.t("hello.name", { name: "Ana" }), "Olá Ana");
    assert.equal(i18n.t("missing.key"), "missing.key");
  } finally {
    i18n.messages["pt-BR"] = previousTable;
    i18n.locale = previousLocale;
  }
});

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

export function compileSchema(relativePath) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  return ajv.compile(readJson(relativePath));
}

export { ROOT };

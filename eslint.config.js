import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import jsdoc from "eslint-plugin-jsdoc";
import n from "eslint-plugin-n";
import security from "eslint-plugin-security";
import sonarjs from "eslint-plugin-sonarjs";
import prettier from "eslint-config-prettier";
import globals from "globals";
import requireTests from "./eslint/plugin-require-tests.js";
import testQuality from "./eslint/plugin-test-quality.js";

const publicJs = ["public/js/**/*.js"];
const nodeJs = [
  "src/**/*.js",
  "server.js",
  "scripts/**/*.mjs",
  "scripts/**/*.js",
  "test/**/*.js",
  "eslint.config.js",
  "eslint/**/*.js",
];

/** Process/DOM glue: not unit-tested. New logic modules are not exempt. */
const glueWithoutUnitTests = [
  "src/index.js",
  "src/signaling/**",
  "public/js/main.js",
  "public/js/operator.js",
  "public/js/joystick.js",
  "public/js/ui/**",
  "public/js/media/**",
  "public/js/signaling/**",
  "public/js/webrtc/peer.js",
  "public/js/webrtc/ice.js",
];

export default [
  {
    ignores: ["node_modules/**", "reports/**", "public/assets/**"],
  },
  js.configs.recommended,
  {
    ...n.configs["flat/recommended-module"],
    files: nodeJs,
  },
  {
    files: nodeJs,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "n/prefer-node-protocol": "error",
    },
  },
  {
    files: ["scripts/**/*.mjs", "eslint.config.js", "eslint/**/*.js", "test/**/*.js"],
    rules: {
      "n/no-unpublished-import": "off",
      "n/no-process-exit": "off",
      "n/hashbang": "off",
    },
  },
  {
    files: publicJs,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        io: "readonly",
      },
    },
  },
  {
    plugins: { jsdoc, security, sonarjs },
    rules: {
      "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": [
        "warn",
        { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      complexity: ["warn", 15],
      "max-depth": ["warn", 4],
      "max-nested-callbacks": ["warn", 4],
      "max-params": ["warn", 4],
      "sonarjs/cognitive-complexity": ["warn", 15],
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "error",
      "security/detect-unsafe-regex": "error",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: publicJs,
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "protocol", pattern: "public/js/protocol/*" },
        { type: "feature", pattern: "public/js/features/*" },
        { type: "webrtc", pattern: "public/js/webrtc/*" },
        { type: "media", pattern: "public/js/media/*" },
        { type: "ui", pattern: "public/js/ui/*" },
        { type: "signaling", pattern: "public/js/signaling/*" },
        { type: "i18n", pattern: "public/js/i18n/*" },
        { type: "joystick", pattern: "public/js/joystick.js" },
        { type: "headLook", pattern: "public/js/head-look.js" },
        { type: "operator", pattern: "public/js/operator.js" },
        { type: "main", pattern: "public/js/main.js" },
      ],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          message:
            "${file.type} must not import ${dependency.type} (capability widgets cannot touch WebRTC)",
          rules: [
            { from: "protocol", allow: [] },
            {
              from: "feature",
              allow: ["protocol", "signaling", "ui", "i18n", "joystick", "headLook"],
            },
            { from: "webrtc", allow: ["protocol", "signaling"] },
            { from: "media", allow: [] },
            { from: "ui", allow: [] },
            { from: "signaling", allow: ["protocol"] },
            { from: "i18n", allow: [] },
            { from: "joystick", allow: [] },
            { from: "headLook", allow: ["protocol"] },
            {
              from: "operator",
              allow: [
                "feature",
                "protocol",
                "signaling",
                "ui",
                "webrtc",
                "media",
                "i18n",
              ],
            },
            { from: "main", allow: ["operator", "ui", "i18n"] },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.js", "public/js/**/*.js"],
    ignores: glueWithoutUnitTests,
    plugins: { "require-tests": requireTests },
    rules: {
      "require-tests/imported-from-test": "error",
    },
  },
  {
    files: ["test/**/*.test.js"],
    plugins: { "test-quality": testQuality },
    rules: {
      "n/prefer-import/assert-strict": "error",
      "test-quality/use-node-test": "error",
      "test-quality/use-strict-assert": "error",
      "test-quality/has-test": "error",
      "test-quality/require-assertions": "error",
      "test-quality/no-focused": "error",
      "test-quality/no-disabled": "error",
      "test-quality/unique-titles": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["node:test", "**/helpers/harness.js", "**/test/run.js"],
              message:
                "Import { test } from ../helpers/test.js so npm test runs on Node 16. Files are discovered automatically.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["test/**/*.js", "scripts/**/*.mjs", "eslint/**/*.js"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      complexity: "off",
      "sonarjs/cognitive-complexity": "off",
    },
  },
  prettier,
];

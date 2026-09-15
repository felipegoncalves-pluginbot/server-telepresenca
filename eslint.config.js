import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import jsdoc from "eslint-plugin-jsdoc";
import security from "eslint-plugin-security";
import sonarjs from "eslint-plugin-sonarjs";
import prettier from "eslint-config-prettier";
import globals from "globals";

const publicJs = ["public/js/**/*.js"];

export default [
  {
    ignores: [
      "node_modules/**",
      "reports/**",
      "public/assets/**",
    ],
  },
  js.configs.recommended,
  {
    files: [
      "src/**/*.js",
      "scripts/**/*.mjs",
      "scripts/**/*.js",
      "test/**/*.js",
      "eslint.config.js",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
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
              allow: ["protocol", "signaling", "ui", "i18n", "joystick"],
            },
            { from: "webrtc", allow: ["protocol", "signaling"] },
            { from: "media", allow: [] },
            { from: "ui", allow: [] },
            { from: "signaling", allow: ["protocol"] },
            { from: "i18n", allow: [] },
            { from: "joystick", allow: [] },
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
    files: ["test/**/*.js", "scripts/**/*.mjs"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      complexity: "off",
      "sonarjs/cognitive-complexity": "off",
    },
  },
  prettier,
];

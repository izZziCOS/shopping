import js from "@eslint/js";
import globals from "globals";

const STATE_MESSAGE = "Change app state through the actions in store.js.";
const MUTATING_METHODS = "/^(add|delete|clear|set|push|pop|shift|unshift|splice|sort|reverse)$/";

export default [
  { ignores: ["node_modules/", "_site/", "playwright-report/", "test-results/"] },
  js.configs.recommended,
  {
    files: ["public/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["public/js/boot.js"],
    languageOptions: { sourceType: "script", globals: globals.browser },
  },
  {
    files: ["public/sw.js"],
    languageOptions: { sourceType: "script", globals: globals.serviceworker },
  },
  {
    files: ["tests/**/*.js", "eslint.config.js", "playwright.config.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    rules: {
      "no-unused-vars": ["error", { args: "after-used", caughtErrors: "none" }],
      eqeqeq: "error",
      "prefer-const": "error",
    },
  },
  {
    files: ["public/js/**/*.js"],
    ignores: ["public/js/store.js"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "AssignmentExpression[left.object.name='state']", message: STATE_MESSAGE },
        { selector: "AssignmentExpression[left.object.object.name='state']", message: STATE_MESSAGE },
        { selector: "UpdateExpression[argument.object.name='state']", message: STATE_MESSAGE },
        {
          selector: "CallExpression[callee.object.name='Object'][callee.property.name='assign'][arguments.0.name='state']",
          message: STATE_MESSAGE,
        },
        {
          selector: `CallExpression[callee.object.object.name='state'][callee.property.name=${MUTATING_METHODS}]`,
          message: STATE_MESSAGE,
        },
      ],
    },
  },
];

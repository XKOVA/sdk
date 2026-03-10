import { createJavaScriptBaseline, createTypeScriptBaseline } from "../../eslint.base.mjs";

const parser = (await import("@typescript-eslint/parser")).default;
const typescriptPlugin = (await import("@typescript-eslint/eslint-plugin")).default;

const tsBase = createTypeScriptBaseline({
  files: ["src/**/*.ts"],
  parser,
  typescriptPlugin,
});

const jsBase = createJavaScriptBaseline({
  files: ["tests/**/*.js"],
});

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [tsBase, jsBase];

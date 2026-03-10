import { createTypeScriptBaseline } from "../../eslint.base.mjs";

const parser = (await import("@typescript-eslint/parser")).default;
const typescriptPlugin = (await import("@typescript-eslint/eslint-plugin")).default;

const tsBase = createTypeScriptBaseline({
  files: ["src/**/*.{ts,tsx}"],
  parser,
  typescriptPlugin,
});

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  {
    ...tsBase,
    rules: {
      ...tsBase.rules,
      /**
       * Umbrella package guardrail:
       * keep @xkova/sdk on public package entry points (no deep internal imports).
       */
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@xkova/*/src/*", "@xkova/*/dist/*"],
              message: "Do not deep-import package internals from @xkova/sdk. Use public package entry points.",
            },
          ],
        },
      ],
    },
  },
];

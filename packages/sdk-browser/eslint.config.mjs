import { createTypeScriptBaseline } from "../../eslint.base.mjs";

const parser = (await import("@typescript-eslint/parser")).default;
const typescriptPlugin = (await import("@typescript-eslint/eslint-plugin")).default;

const tsBase = createTypeScriptBaseline({
  files: ["src/**/*.ts"],
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
       * Boundary guardrail:
       * @xkova/sdk-browser is DOM-only (no React/Next/network calls).
       */
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@xkova/sdk-react", message: "React hooks/components are not allowed in @xkova/sdk-browser." },
            { name: "@xkova/sdk-react-ui", message: "UI components are not allowed in @xkova/sdk-browser." },
            { name: "@xkova/sdk-core", message: "Core network/auth logic must stay out of @xkova/sdk-browser." },
          ],
          patterns: [
            { group: ["react", "react/*"], message: "React is forbidden in @xkova/sdk-browser." },
            { group: ["next", "next/*"], message: "Next.js is forbidden in @xkova/sdk-browser." },
            { group: ["node:*"], message: "Node-only modules are forbidden in @xkova/sdk-browser." },
          ],
        },
      ],
    },
  },
];

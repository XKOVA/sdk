import { createTypeScriptBaseline } from "../../eslint.base.mjs";

const parser = (await import("@typescript-eslint/parser")).default;
const typescriptPlugin = (await import("@typescript-eslint/eslint-plugin")).default;

const tsBase = createTypeScriptBaseline({
  files: ["src/**/*.{ts,tsx}"],
  parser,
  typescriptPlugin,
  jsx: true,
});

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  {
    ...tsBase,
    rules: {
      ...tsBase.rules,
      /**
       * Boundary guardrail:
       * @xkova/sdk-react-ui is UI only. It must not do auth/token/transport itself.
       */
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@xkova/sdk-react/src/*", "@xkova/sdk-react/dist/*"],
              message: "Do not deep-import sdk-react internals. Import from @xkova/sdk-react.",
            },
            {
              group: ["@xkova/sdk-core/src/*", "@xkova/sdk-core/dist/*"],
              message: "Do not deep-import sdk-core internals. Import from @xkova/sdk-core.",
            },
          ],
        },
      ],

      // Ban transport/auth construction directly in UI code.
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='APIClient']",
          message: "Do not construct APIClient in @xkova/sdk-react-ui. Use @xkova/sdk-react hooks.",
        },
        {
          selector: "NewExpression[callee.name='OAuthService']",
          message: "Do not construct OAuthService in @xkova/sdk-react-ui. Use @xkova/sdk-react hooks.",
        },
        {
          selector: "CallExpression[callee.name='createXKOVAClient']",
          message: "Do not call createXKOVAClient in @xkova/sdk-react-ui. Use XKOVAProvider + hooks.",
        },
        {
          selector: "CallExpression[callee.name='fetch']",
          message: "Do not call fetch() directly in @xkova/sdk-react-ui. Use @xkova/sdk-react hooks/services.",
        },
      ],
    },
  },
];

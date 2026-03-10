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
       * @xkova/sdk-core is framework-agnostic and must not pull React/Next/UI deps.
       */
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@xkova/sdk-react",
              message: "@xkova/sdk-core must not depend on @xkova/sdk-react.",
            },
            {
              name: "@xkova/sdk-react-ui",
              message: "@xkova/sdk-core must not depend on @xkova/sdk-react-ui.",
            },
          ],
          patterns: [
            { group: ["react", "react/*"], message: "React is forbidden in @xkova/sdk-core." },
            { group: ["next", "next/*"], message: "Next.js is forbidden in @xkova/sdk-core." },
            { group: ["@radix-ui/*"], message: "UI libraries are forbidden in @xkova/sdk-core." },
            { group: ["sonner"], message: "Toasts are forbidden in @xkova/sdk-core." },
            { group: ["lucide-react"], message: "Icons are forbidden in @xkova/sdk-core." },
            {
              group: ["class-variance-authority", "clsx", "tailwind-merge", "tailwindcss", "tw-animate-css"],
              message: "Tailwind/shadcn utilities are forbidden in @xkova/sdk-core.",
            },
          ],
        },
      ],
    },
  },
];

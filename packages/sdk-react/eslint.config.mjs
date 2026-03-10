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
       * sdk-react is headless (provider + hooks) and must not pull UI libraries or Next.js.
       */
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@xkova/sdk-react-ui",
              message:
                "UI components live in @xkova/sdk-react-ui. Keep @xkova/sdk-react headless (provider + hooks).",
            },
            {
              name: "sonner",
              message: "Toasts are UI. Use @xkova/sdk-react-ui.",
            },
          ],
          patterns: [
            {
              group: ["@radix-ui/*"],
              message: "Radix UI is UI. Use @xkova/sdk-react-ui.",
            },
            {
              group: ["lucide-react"],
              message: "Icons are UI. Use @xkova/sdk-react-ui.",
            },
            {
              group: ["class-variance-authority", "clsx", "tailwind-merge"],
              message: "Tailwind/shadcn helpers are UI. Use @xkova/sdk-react-ui.",
            },
            {
              group: ["next", "next/*"],
              message: "Do not couple @xkova/sdk-react to Next.js. Keep it framework-agnostic.",
            },
          ],
        },
      ],
    },
  },
];

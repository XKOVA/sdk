/**
 * Shared minimal ESLint baselines for this standalone SDK repo.
 *
 * Intent: high-signal correctness checks only (no style opinions).
 */

const BASE_IGNORES = ["dist/**", "node_modules/**"];

/**
 * Create the minimal TypeScript baseline for SDK packages.
 *
 * @param {{
 *   files: string[];
 *   parser: any;
 *   typescriptPlugin: any;
 *   jsx?: boolean;
 * }} options
 */
export function createTypeScriptBaseline(options) {
  const { files, parser, typescriptPlugin, jsx = false } = options;

  const languageOptions = {
    ecmaVersion: 2022,
    sourceType: "module",
    parser,
  };

  if (jsx) {
    languageOptions.parserOptions = {
      ecmaFeatures: { jsx: true },
    };
  }

  return {
    files,
    ignores: BASE_IGNORES,
    languageOptions,
    plugins: {
      "@typescript-eslint": typescriptPlugin,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "none",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          caughtErrors: "none",
        },
      ],
      "no-duplicate-imports": "error",
      "no-unreachable": "error",
    },
  };
}

/**
 * Create the minimal JavaScript baseline for SDK packages.
 *
 * @param {{ files: string[] }} options
 */
export function createJavaScriptBaseline(options) {
  const { files } = options;

  return {
    files,
    ignores: BASE_IGNORES,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          args: "none",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          caughtErrors: "none",
        },
      ],
      "no-duplicate-imports": "error",
      "no-unreachable": "error",
    },
  };
}

import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["eslint", "typescript", "unicorn", "oxc", "import", "vitest"],
  categories: { correctness: "error" },
  env: { builtin: true },
  rules: {
    curly: ["error", "all"],
    "typescript/no-non-null-assertion": "error",
    "vitest/no-conditional-in-test": "error",
    "vitest/expect-expect": "error",
    "import/extensions": ["error", "never"],
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "vitest",
            importNames: ["assert"],
            message: "Use `assert` from es-toolkit, which also works outside tests.",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // Vite's native loader requires file extension imports
      files: ["vitest.config.ts"],
      rules: { "import/extensions": "off" },
    },
  ],
});

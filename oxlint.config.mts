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
});

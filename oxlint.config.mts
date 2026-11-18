import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["eslint", "typescript", "unicorn", "oxc", "import", "vitest"],
  categories: { correctness: "error" },
  env: { builtin: true },
});

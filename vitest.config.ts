import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
import { generateKey } from "./src/test-utils/helpers.ts";

// can optionally override with WRANGLER_LOG=debug bun run test
process.env.WRANGLER_LOG ??= "warn";

// NOTE: projects inherit all root properties
export default defineConfig({
  test: {
    fsModuleCache: true,
    silent: "passed-only", // only print logs for failing tests
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.ts"],
      exclude: ["src/**/tests/**", "src/tests/**", "src/test-utils/**"],
      reporter: ["text", "html"],
    },
    projects: [
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.jsonc" },
            remoteBindings: false,
            miniflare: {
              bindings: {
                JWT_PRIVATE_KEY: await generateKey(),

                // add a test-only binding for migrations so they can
                // be applied in a setup file
                TEST_MIGRATIONS: await readD1Migrations("./migrations"),
              },
            },
          }),
        ],
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          setupFiles: ["./src/test-utils/apply-migrations.ts"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/**/*.test.ts"],
          environment: "node",
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});

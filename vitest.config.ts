import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
import { generateKey } from "./src/test-utils/helpers.ts";

export default defineConfig(async () => ({
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
    fsModuleCache: true,
    setupFiles: ["./src/test-utils/apply-migrations.ts"],
  },
}));

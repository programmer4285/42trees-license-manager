import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { createTestHarness } from "wrangler";
import type { GumroadResponse } from "../src/infra/gumroad-license-verifier.ts";

export const harness = createTestHarness({
  workers: [
    {
      configPath: "./wrangler.jsonc",
      env: "local",
    },
  ],
});

export const GUMROAD_VERIFY_URL = "https://api.gumroad.com/v2/licenses/verify";

export const msw = setupServer(
  http.post(GUMROAD_VERIFY_URL, () =>
    HttpResponse.json({
      success: true,
      purchase: { refunded: false, disputed: false, dispute_won: false },
    }),
  ),
);

// Helper to override the default Gumroad response
export function mockGumroad(body: GumroadResponse, init?: ResponseInit) {
  msw.use(http.post(GUMROAD_VERIFY_URL, () => HttpResponse.json(body, init)));
}

beforeAll(async () => {
  // Fail the test if the worker receives a request for an unmocked host
  msw.listen({ onUnhandledFrame: "error" });
  await harness.listen();
});

beforeEach(async () => {
  await harness.getWorker().applyD1Migrations("DB");
});

afterEach(async (ctx) => {
  if (ctx.task.result?.state === "fail") {
    harness.debug();
  }

  msw.resetHandlers();
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
  msw.close();
});

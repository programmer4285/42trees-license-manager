import { expect, test } from "vitest";
import { harness } from "./harness";

test("GET /v1/jwks returns the public key set", async () => {
  const res = await harness.fetch("/v1/jwks");
  const body = (await res.json()) as { keys: unknown[] };

  expect(res.status).toBe(200);
  expect(body.keys).toHaveLength(1);
});

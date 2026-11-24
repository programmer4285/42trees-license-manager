import { expect, test } from "vitest";
import { harness } from "./harness";

test("GET /v1/health reports ok against a real D1 binding", async () => {
  const res = await harness.fetch("/v1/health");

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});

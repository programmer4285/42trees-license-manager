import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { newLicenseService } from "../../application/license-service";
import type { LicenseError } from "../../application/license-verifier";
import { err, ok, type Result } from "../../shared/result";
import { newHonoTokenService } from "../hono-token-service";
import { newInMemoryLicenseRepo } from "../inmemory-license-repo";
import { newLicenseHandler } from "../license-handler";
import { newNoopLicenseVerifier } from "../noop-license-verifier";
import { generateKey } from "../../test-utils/helpers";

async function newApp(verdict: Result<void, LicenseError> = ok(undefined)) {
  const tokenService = newHonoTokenService({
    jwk: await generateKey(),
    issuer: "unittest",
    ttlSeconds: 60,
  });
  const service = newLicenseService(
    newInMemoryLicenseRepo(),
    newNoopLicenseVerifier(verdict),
    tokenService,
  );
  const handler = newLicenseHandler(service, tokenService);
  return new Hono().post("/v1/activate", (c) => handler.activate(c));
}

function activate(app: Hono, body: string) {
  return app.request("/v1/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

const validBody = JSON.stringify({
  licenseKey: crypto.randomUUID(),
  productId: crypto.randomUUID(),
  deviceId: crypto.randomUUID(),
});

describe("POST /v1/activate", () => {
  it("returns a token for a valid license", async () => {
    const res = await activate(await newApp(), validBody);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: expect.any(String) });
  });

  it.each([
    ["malformed JSON", "{not json"],
    [
      "a deviceId that is not a UUID",
      JSON.stringify({ licenseKey: "k", productId: "p", deviceId: "d" }),
    ],
    ["a missing field", JSON.stringify({ licenseKey: "k" })],
  ])("rejects %s with 400 InvalidRequest", async (_, body) => {
    const res = await activate(await newApp(), body);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "InvalidRequest" });
  });

  it.each([
    [{ kind: "LicenseNotFound" }, 404],
    [{ kind: "LicenseRefunded" }, 403],
    [{ kind: "LicenseDisputed" }, 403],
    [{ kind: "UpstreamUnavailable", cause: new Error("gumroad down") }, 503],
  ] satisfies [LicenseError, number][])("maps %o to %i", async (error, status) => {
    const res = await activate(await newApp(err(error)), validBody);

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: error.kind });
  });
});

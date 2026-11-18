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
import { noopLogger, wideEventMiddleware, type Logger, type WideEvent } from "../wide-event";

async function newApp(
  verdict: Result<void, LicenseError> = ok(undefined),
  log: Logger = noopLogger,
) {
  const tokenService = newHonoTokenService({
    jwk: await generateKey(),
    issuer: "unittest",
    ttlSeconds: 60,
  });
  const service = newLicenseService(
    newInMemoryLicenseRepo(),
    newNoopLicenseVerifier(verdict),
    tokenService,
    { seatLimit: 1 },
  );
  const handler = newLicenseHandler(service, tokenService);
  return new Hono().use(wideEventMiddleware(log)).post("/v1/activate", (c) => handler.activate(c));
}

function activate(app: Pick<Hono, "request">, body: string) {
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

  it("rejects a new device on a full license with 403 SeatLimitReached", async () => {
    const app = await newApp();
    const licenseKey = crypto.randomUUID();
    const productId = crypto.randomUUID();
    const bodyFor = (deviceId: string) => JSON.stringify({ licenseKey, productId, deviceId });
    await activate(app, bodyFor(crypto.randomUUID()));

    const res = await activate(app, bodyFor(crypto.randomUUID()));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "SeatLimitReached" });
  });

  describe("wide event", () => {
    async function activateAndCapture(verdict: Result<void, LicenseError>, body = validBody) {
      const events: WideEvent[] = [];
      await activate(await newApp(verdict, (e) => events.push(e)), body);
      return events;
    }

    it("emits one event describing a successful activation", async () => {
      const { productId, deviceId, licenseKey } = JSON.parse(validBody);

      const events = await activateAndCapture(ok(undefined));

      expect(events).toEqual([
        expect.objectContaining({
          method: "POST",
          path: "/v1/activate",
          status: 200,
          outcome: "LicenseActivated",
          seat: "created",
          productId,
          deviceId,
        }),
      ]);
      expect(JSON.stringify(events)).not.toContain(licenseKey);
    });

    it("records the outcome of a rejected request", async () => {
      const events = await activateAndCapture(ok(undefined), "{not json");

      expect(events).toEqual([expect.objectContaining({ status: 400, outcome: "InvalidRequest" })]);
    });

    it("records the upstream cause when the license provider is down", async () => {
      const events = await activateAndCapture(
        err({ kind: "UpstreamUnavailable", cause: new Error("gumroad down") }),
      );

      expect(events).toEqual([
        expect.objectContaining({
          status: 503,
          outcome: "UpstreamUnavailable",
          error: { name: "Error", message: "gumroad down" },
        }),
      ]);
    });
  });
});

import { describe, expect, test } from "vitest";
import { mockGumroad, harness } from "./harness";

type ActivateBody = { licenseKey: string; productId: string; deviceId: string };

function activate(overrides: Partial<ActivateBody> = {}) {
  const body: ActivateBody = {
    licenseKey: "some-license-key",
    productId: "some-product-id",
    deviceId: crypto.randomUUID(),
    ...overrides,
  };

  return harness.fetch("/v1/activate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /v1/activate", () => {
  test("issues a token for a valid license", async () => {
    const res = await activate();

    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string };
    expect(token.split(".")).toHaveLength(3);
  });

  test("rejects a refunded license", async () => {
    mockGumroad({
      success: true,
      purchase: { refunded: true, disputed: false, dispute_won: false },
    });

    const res = await activate();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "LicenseRefunded" });
  });

  test("rejects an unknown license", async () => {
    mockGumroad({ success: false, message: "That license does not exist" }, { status: 404 });

    const res = await activate();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "LicenseNotFound" });
  });

  test("returns 503 when Gumroad is unavailable", async () => {
    mockGumroad({ success: false, message: "oops" }, { status: 500 });

    const res = await activate();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "UpstreamUnavailable" });
  });

  test("enforces the seat limit, but lets existing devices re-activate", async () => {
    // should match whatever SEAT_LIMIT is configured
    const devices = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    for (const deviceId of devices) {
      expect((await activate({ deviceId })).status).toBe(200);
    }

    const fourth = await activate();
    expect(fourth.status).toBe(403);
    expect(await fourth.json()).toEqual({ error: "SeatLimitReached" });

    const again = await activate({ deviceId: devices[0] });
    expect(again.status).toBe(200);
  });

  test("rejects an invalid request body", async () => {
    const res = await activate({ deviceId: "not-a-uuid" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "InvalidRequest" });
  });
});

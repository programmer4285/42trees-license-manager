import { assert } from "es-toolkit";
import { describe, expect, it } from "vitest";
import { newGumroadLicenseVerifier } from "../gumroad-license-verifier";

const req = { licenseKey: crypto.randomUUID(), productId: crypto.randomUUID() };

function verifierRespondingWith(status: number, body: unknown) {
  return newGumroadLicenseVerifier({
    fetch: async () => Response.json(body, { status }),
  });
}

function purchase(
  overrides: Partial<{ refunded: boolean; disputed: boolean; dispute_won: boolean }>,
) {
  return {
    success: true,
    purchase: { refunded: false, disputed: false, dispute_won: false, ...overrides },
  };
}

describe("gumroad license verifier", () => {
  it("sends the license key and product id to Gumroad's verify endpoint", async () => {
    let sent: Request | undefined;
    const verifier = newGumroadLicenseVerifier({
      fetch: async (input) => {
        sent = input as Request;
        return Response.json(purchase({}));
      },
    });

    await verifier.verify(req);

    assert(sent, "fetch was not called");
    const url = new URL(sent.url);
    expect(sent.method).toBe("POST");
    expect(url.origin + url.pathname).toBe("https://api.gumroad.com/v2/licenses/verify");
    expect(url.searchParams.get("license_key")).toBe(req.licenseKey);
    expect(url.searchParams.get("product_id")).toBe(req.productId);
  });

  it("accepts a clean purchase", async () => {
    const result = await verifierRespondingWith(200, purchase({})).verify(req);

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("accepts a dispute the seller won", async () => {
    const verifier = verifierRespondingWith(200, purchase({ disputed: true, dispute_won: true }));

    const result = await verifier.verify(req);

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it.each([
    [
      "an unknown license (404)",
      404,
      { success: false, message: "That license does not exist" },
      "LicenseNotFound",
    ],
    ["a refunded purchase", 200, purchase({ refunded: true }), "LicenseRefunded"],
    ["a lost dispute", 200, purchase({ disputed: true }), "LicenseDisputed"],
    ["a Gumroad server error", 500, { success: false, message: "oops" }, "UpstreamUnavailable"],
  ])("rejects %s", async (_, status, body, kind) => {
    const result = await verifierRespondingWith(status, body).verify(req);

    expect(result).toMatchObject({ ok: false, error: { kind } });
  });

  it("reports a network failure as UpstreamUnavailable", async () => {
    const verifier = newGumroadLicenseVerifier({
      fetch: async () => {
        throw new Error("fetch failed");
      },
    });

    const result = await verifier.verify(req);

    expect(result).toMatchObject({ ok: false, error: { kind: "UpstreamUnavailable" } });
  });
});
